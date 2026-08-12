import prisma from '../utils/prisma';
import { CaseStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { CreateTestCaseInput, UpdateTestCaseInput } from '../validations/testCase.validation';
import { ProjectAccess } from '../utils/projectAccess';
import { notificationService, NotificationType } from './notification.service';
import { assertTestCaseTransition } from '../utils/stateMachine';
import { knowledgeService } from './knowledge.service';
import { artifactService } from './artifact.service';
import { impactAnalysisService } from './impactAnalysis.service';
import { auditService } from './audit.service';
import { dataGovernanceService } from './data-governance.service';

const mapStepForClient = (step: any, index: number) => ({
    ...step,
    action: step?.action || step?.name || '',
    expected: step?.expected ?? step?.expectedResult ?? '',
    expectedResult: step?.expected ?? step?.expectedResult ?? '',
    type: step?.type || 'MANUAL',
    actionType: step?.actionType || '',
    locator: step?.locator || '',
    data: step?.data || '',
    order: step?.order || index + 1,
});

const normalizeStepForStorage = (step: any, index: number) => {
    const expected = String(step?.expected ?? step?.expectedResult ?? '');
    const requestedType = String(step?.type || 'MANUAL').toUpperCase();

    return {
        action: String(step?.action || step?.name || ''),
        expected,
        expectedResult: expected,
        type: ['MANUAL', 'WEB', 'MOBILE'].includes(requestedType) ? requestedType : 'MANUAL',
        actionType: String(step?.actionType || ''),
        locator: String(step?.locator || ''),
        data: String(step?.data || ''),
        order: index + 1,
    };
};

const extractClientSteps = (testCase: any) => {
    const relationalSteps = testCase?.testCaseSteps?.map((ts: any) => ts.testStep) || [];
    const sourceSteps = relationalSteps.length > 0
        ? relationalSteps
        : Array.isArray(testCase?.steps)
            ? testCase.steps
            : [];

    return sourceSteps.map(mapStepForClient);
};

export class TestCaseService {
    private async getBulkProjectContext(ids: string[]) {
        const testCases = await prisma.testCase.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                authorId: true,
                status: true,
                deletedAt: true,
                suite: {
                    select: {
                        projectId: true,
                    },
                },
            },
        });

        if (testCases.length !== ids.length || testCases.some((testCase) => testCase.deletedAt)) {
            throw new AppError('Some test cases were not found', 404);
        }

        const projectIds = new Set(testCases.map((testCase) => testCase.suite.projectId));
        if (projectIds.size !== 1) {
            throw new AppError('Bulk operations must target test cases from a single project', 400);
        }

        return testCases;
    }

    async create(data: CreateTestCaseInput, userId: string, role: string) {
        if (!data.suiteId && !data.projectId) throw new AppError('Project is required for an orphan test case', 400);
        // Check suite exists
        let suite = await (prisma.testSuite as any).findUnique({
            where: { id: data.suiteId || '__missing__' },
            include: {
                project: {
                    select: {
                        id: true,
                        key: true,
                        nextTestCaseNumber: true,
                    },
                },
            },
        });

        if (!suite && data.projectId) {
            const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
            if (!project) throw new AppError('Project not found', 404);
            suite = await prisma.testSuite.findFirst({ where: { projectId: data.projectId, name: '__ORPHAN_CASES__' } });
            if (!suite) suite = await prisma.testSuite.create({ data: { name: '__ORPHAN_CASES__', projectId: data.projectId } });
        }
        if (!suite) {
            throw new AppError('Test suite not found', 404);
        }

        await ProjectAccess.check(suite.projectId, userId, role);

        const storedSteps = (data.steps || []).map(normalizeStepForStorage);
        const { suiteId: _suiteId, projectId: _projectId, steps: _steps, ...caseData } = data;

        const testCase = await prisma.$transaction(async (tx) => {
            const project = await (tx.project as any).update({
                where: { id: suite.projectId },
                data: { nextTestCaseNumber: { increment: 1 } },
                select: {
                    key: true,
                    nextTestCaseNumber: true,
                },
            });
            const sequenceNumber = project.nextTestCaseNumber - 1;

            const created = await (tx.testCase as any).create({
                data: {
                    ...caseData,
                    steps: storedSteps,
                    suiteId: suite.id,
                    key: `${project.key}-TC-${sequenceNumber}`,
                    sequenceNumber,
                    authorId: userId,
                    status: 'DRAFT', // Always start as DRAFT
                    version: 1,
                } as any,
            });

            for (let i = 0; i < storedSteps.length; i++) {
                const step = storedSteps[i];
                const testStep = await (tx.testStep as any).create({
                    data: {
                        projectId: suite.projectId,
                        action: step.action,
                        expectedResult: step.expectedResult,
                        type: step.type,
                        actionType: step.actionType,
                        locator: step.locator,
                        data: step.data,
                    },
                });
                await (tx.testCaseStep as any).create({
                    data: { testCaseId: created.id, testStepId: testStep.id, orderIndex: i },
                });
            }

            return created;
        });

        await artifactService.createRevision({
            entityType: 'TestCase',
            entityId: testCase.id,
            body: testCase,
            authorId: userId,
            status: 'DRAFT'
        });

        await auditService.logCreate(
            { actorId: userId, projectId: suite.projectId },
            'TestCase',
            testCase.id,
            testCase
        );

        // Index for Project Memory
        knowledgeService.indexEntity(suite.projectId, 'TestCase', testCase.id, `${testCase.title}\n${testCase.description || ''}\n${testCase.preconditions || ''}`);

        return testCase;
    }

    async getAll(userId: string, role: string, suiteId?: string, includeDeleted: boolean = false) {
        if (suiteId) {
            await ProjectAccess.checkBySuite(suiteId, userId, role);
        }

        let where: any = {};
        if (suiteId) {
            where.suiteId = suiteId;
        }

        // Handle soft delete logic
        if (!includeDeleted) {
            where.deletedAt = null;
        }

        const cases = await prisma.testCase.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                key: true,
                sequenceNumber: true,
                title: true,
                priority: true,
                status: true,
                version: true,
                suiteId: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                steps: true,
                testCaseSteps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                } as any,
                tags: { select: { tag: true } },
                author: { select: { firstName: true, lastName: true } },
            },
        } as any);

        return cases.map(c => {
            const { testCaseSteps, steps: legacySteps, ...rest } = c as any;
            const mappedSteps = extractClientSteps({ testCaseSteps, steps: legacySteps });
            return {
                ...rest,
                steps: mappedSteps,
                hasSteps: mappedSteps.length > 0
            };
        });
    }

    async getAllByProject(userId: string, role: string, projectId?: string, page: number = 1, limit: number = 50, search?: string) {
        if (projectId && projectId !== 'all') {
            await ProjectAccess.check(projectId, userId, role);
        }
        const where: any = { deletedAt: null };
        if (projectId && projectId !== 'all') {
            where.suite = { projectId };
        }
        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        const [total, cases] = await Promise.all([
            prisma.testCase.count({ where }),
            prisma.testCase.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    key: true,
                    sequenceNumber: true,
                    title: true,
                    priority: true,
                    status: true,
                    version: true,
                    suiteId: true,
                    authorId: true,
                    createdAt: true,
                    updatedAt: true,
                    steps: true,
                    testCaseSteps: {
                        include: { testStep: true },
                        orderBy: { orderIndex: 'asc' }
                    },
                    automationScenarios: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            status: true,
                            version: true,
                            updatedAt: true,
                            steps: {
                                select: { id: true },
                            },
                        },
                    },
                    tags: { select: { tag: true } },
                    author: { select: { firstName: true, lastName: true } },
                    suite: { select: { name: true, projectId: true } },
                },
            } as any)
        ]);

        return {
            data: cases.map(c => {
                const { testCaseSteps, steps: legacySteps, ...rest } = c as any;
                const mappedSteps = extractClientSteps({ testCaseSteps, steps: legacySteps });
                return {
                    ...rest,
                    steps: mappedSteps,
                    hasSteps: mappedSteps.length > 0
                };
            }),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getById(id: string, userId: string, role: string) {
        const testCase = await (prisma.testCase as any).findUnique({
            where: { id, deletedAt: null },
            include: {
                author: { select: { firstName: true, lastName: true } },
                suite: { select: { name: true, projectId: true } },
                history: { orderBy: { version: 'desc' } },
                tags: { include: { tag: true } },
                testCaseSteps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                },
            },
        });

        if (!testCase) {
            throw new AppError('Test case not found', 404);
        }

        await ProjectAccess.check(testCase.suite.projectId, userId, role);

        const { testCaseSteps, steps: legacySteps, ...rest } = testCase as any;
        const mappedSteps = extractClientSteps({ testCaseSteps, steps: legacySteps });
        return {
            ...rest,
            steps: mappedSteps,
            hasSteps: mappedSteps.length > 0
        };
    }

    async getByKey(key: string, userId: string, role: string) {
        const normalizedKey = key.trim().toUpperCase();
        const include = {
            author: { select: { firstName: true, lastName: true } },
            suite: { select: { name: true, projectId: true } },
            history: { orderBy: { version: 'desc' } },
            tags: { include: { tag: true } },
            testCaseSteps: {
                include: { testStep: true },
                orderBy: { orderIndex: 'asc' }
            },
        };
        let testCase = await (prisma.testCase as any).findUnique({
            where: { key: normalizedKey, deletedAt: null },
            include,
        });

        // Backward compatibility for pre-namespace links such as /tc/NEX-12.
        if (!testCase && !normalizedKey.includes('-TC-')) {
            const legacyMatch = normalizedKey.match(/^([A-Z0-9-]+)-(\d+)$/);
            if (legacyMatch) {
                testCase = await (prisma.testCase as any).findFirst({
                    where: {
                        sequenceNumber: Number(legacyMatch[2]),
                        deletedAt: null,
                        suite: { project: { key: legacyMatch[1] } },
                    },
                    include,
                });
            }
        }

        if (!testCase) {
            throw new AppError('Test case not found', 404);
        }

        await ProjectAccess.check(testCase.suite.projectId, userId, role);

        const { testCaseSteps, steps: legacySteps, ...rest } = testCase as any;
        const mappedSteps = extractClientSteps({ testCaseSteps, steps: legacySteps });
        return {
            ...rest,
            steps: mappedSteps,
            hasSteps: mappedSteps.length > 0
        };
    }

    async update(id: string, data: UpdateTestCaseInput, userId: string, userRole: string) {
        const testCase = await this.getById(id, userId, userRole);

        // Permission check for status changes
        if (data.status) {
            if (data.status === 'APPROVED' && !['TEAM_LEADER', 'ADMIN'].includes(userRole)) {
                throw new AppError('Only Team Leaders and Admins can approve test cases', 403);
            }
            assertTestCaseTransition(testCase.status as any, data.status as any);
        }

        // Check if there are actual changes
        const currentSteps = (testCase as any).steps || [];
        const newSteps = data.steps ?? currentSteps;
        const storedSteps = newSteps.map(normalizeStepForStorage);

        // Normalize steps for comparison (strip id, order, extra fields from DB)
        const normalizeStep = (s: any) => ({
            action: s.action || "",
            expectedResult: s.expected ?? s.expectedResult ?? "",
            type: s.type || 'MANUAL',
            actionType: s.actionType || '',
            locator: s.locator || '',
            data: s.data || '',
        });

        const stepsChanged = JSON.stringify(currentSteps.map(normalizeStep)) !== JSON.stringify(newSteps.map(normalizeStep));

        const hasChanges =
            (data.title !== undefined && data.title !== testCase.title) ||
            (data.description !== undefined && data.description !== (testCase.description || "")) ||
            (data.preconditions !== undefined && data.preconditions !== (testCase.preconditions || "")) ||
            (data.priority !== undefined && data.priority !== testCase.priority) ||
            (data.status !== undefined && data.status !== testCase.status) ||
            stepsChanged;

        if (!hasChanges) {
            return testCase;
        }

        const { steps, ...updateData } = data as any;

        // History, relations and the main record must commit or roll back together.
        const updated = await prisma.$transaction(async (tx) => {
            await tx.testCaseHistory.create({
                data: {
                    testCaseId: testCase.id,
                    version: testCase.version,
                    title: testCase.title,
                    steps: currentSteps,
                    preconditions: testCase.preconditions,
                    changedById: userId,
                },
            });

            if (stepsChanged) {
                await tx.testCaseStep.deleteMany({ where: { testCaseId: id } });
                for (let i = 0; i < newSteps.length; i++) {
                    const s = storedSteps[i];
                    const newStep = await tx.testStep.create({
                        data: {
                            projectId: testCase.suite.projectId,
                            action: s.action,
                            expectedResult: s.expectedResult,
                            type: s.type as any,
                            actionType: s.actionType,
                            locator: s.locator,
                            data: s.data,
                        },
                    });
                    await tx.testCaseStep.create({
                        data: { testCaseId: id, testStepId: newStep.id, orderIndex: i },
                    });
                }
            }

            return tx.testCase.update({
                where: { id },
                data: {
                    title: updateData.title,
                    description: updateData.description,
                    preconditions: updateData.preconditions,
                    // Keep the legacy JSON representation in sync with the
                    // relational steps. It is still used by older readers and
                    // is the fallback when a relation is not available.
                    steps: data.steps !== undefined ? storedSteps : undefined,
                    priority: updateData.priority,
                    status: updateData.status,
                    version: { increment: 1 },
                    impactStatus: 'CLEAN',
                    impactReason: null,
                },
            });
        });

        await artifactService.createRevision({
            entityType: 'TestCase',
            entityId: updated.id,
            body: updated,
            authorId: userId,
            status: (updated.status as any) || 'DRAFT'
        });

        await auditService.logUpdate(
            { actorId: userId, projectId: testCase.suite.projectId },
            'TestCase',
            updated.id,
            testCase,
            updated
        );

        // Update index for Project Memory
        knowledgeService.indexEntity(testCase.suite.projectId, 'TestCase', updated.id, `${updated.title}\n${updated.description || ''}\n${updated.preconditions || ''}`);

        return updated;
    }

    async revertToVersion(id: string, version: number, userId: string, role: string) {
        const testCase = await this.getById(id, userId, role);

        // Find historical version
        const historyEntry = await prisma.testCaseHistory.findFirst({
            where: { testCaseId: id, version },
        });

        if (!historyEntry) {
            throw new AppError('Version not found', 404);
        }

        const currentSteps = (testCase as any).steps || [];

        // Create history entry for current state before reverting
        await prisma.testCaseHistory.create({
            data: {
                testCaseId: testCase.id,
                version: testCase.version,
                title: testCase.title,
                steps: currentSteps,
                preconditions: testCase.preconditions,
                changedById: userId,
            },
        });

        // Revert steps relationally
        const histSteps = (historyEntry.steps as any[]) || [];

        await prisma.testCaseStep.deleteMany({
            where: { testCaseId: id }
        });

        for (let i = 0; i < histSteps.length; i++) {
            const s = histSteps[i];
            const newStep = await prisma.testStep.create({
                data: {
                    projectId: testCase.suite.projectId,
                    action: s.action || s.name || '',
                    expectedResult: s.expectedResult || s.expected || '',
                }
            });
            await prisma.testCaseStep.create({
                data: {
                    testCaseId: id,
                    testStepId: newStep.id,
                    orderIndex: i
                }
            });
        }

        // Revert to historical data as a NEW version
        return prisma.testCase.update({
            where: { id },
            data: {
                title: historyEntry.title,
                preconditions: historyEntry.preconditions,
                // Keep current priority/status/suite? Usually revert keeps old content but maybe not status.
                version: { increment: 1 },
            },
        });
    }

    async delete(id: string, userId: string, role: string, hardDelete: boolean = false) {
        const existing = await this.getById(id, userId, role);

        if (hardDelete) {
            await dataGovernanceService.assertPermanentDeletionAllowed(existing.suite.projectId);
            // Permanent delete
            const result = await prisma.testCase.delete({
                where: { id },
            });

            await auditService.logDelete(
                { actorId: userId, projectId: existing.suite.projectId },
                'TestCase',
                id,
                existing
            );

            return result;
        }

        // Soft delete
        const softDeleted = await prisma.testCase.update({
            where: { id },
            data: {
                deletedAt: new Date(),
            },
        });

        await auditService.logUpdate(
            { actorId: userId, projectId: existing.suite.projectId },
            'TestCase',
            id,
            existing,
            softDeleted,
            'Soft delete'
        );

        return softDeleted;
    }

    async restore(id: string, userId: string, role: string) {
        // We can't use getById here because it might filter out deleted ones if we changed getById. 
        // But getById implementation currently just checks ID and perms, it does NOT filter deletedAt (checked line 117-124).
        // Let's verify if getById filters soft deleted.
        // Looking at line 117: `prisma.testCase.findUnique({ where: { id } })`. Unique find returns even if deletedAt is set unless we use middleware or explicit check.
        // So getById is safe to use for permission check.
        await this.getById(id, userId, role);

        return prisma.testCase.update({
            where: { id },
            data: {
                deletedAt: null,
            },
        });
    }

    async approve(id: string, userId: string, role: string) {
        const testCase = await this.getById(id, userId, role);

        assertTestCaseTransition(testCase.status as any, 'APPROVED');

        const updated = await prisma.testCase.update({
            where: { id },
            data: {
                status: 'APPROVED',
            },
        });

        await prisma.approvalEvent.create({
            data: {
                projectId: testCase.suite.projectId,
                testCaseId: testCase.id,
                approverId: userId,
            },
        });

        // Notify the author that their test case was approved
        if (testCase.authorId && testCase.authorId !== userId) {
            notificationService.notifyUser(testCase.authorId, {
                type: NotificationType.TEST_CASE_APPROVED,
                title: 'Test Senaryosu Onaylandı',
                message: `"${testCase.title}" test senaryonuz onaylandı.`,
                data: { testCaseId: id, suiteId: testCase.suiteId, projectId: testCase.suite.projectId }
            });
        }

        return updated;
    }

    async requestRevision(id: string, userId: string, role: string, comment?: string) {
        const testCase = await this.getById(id, userId, role);

        assertTestCaseTransition(testCase.status as any, 'REVISE');

        const updated = await prisma.testCase.update({
            where: { id },
            data: {
                status: 'REVISE',
            },
        });

        // Notify the author that revision is requested
        if (testCase.authorId && testCase.authorId !== userId) {
            notificationService.notifyUser(testCase.authorId, {
                type: NotificationType.TEST_CASE_REVISION_REQUESTED,
                title: 'Revizyon Talep Edildi',
                message: `"${testCase.title}" için revizyon talep edildi.${comment ? ` Not: ${comment}` : ''}`,
                data: { testCaseId: id, suiteId: testCase.suiteId, projectId: testCase.suite.projectId, comment }
            });
        }

        return updated;
    }
    async getHistory(id: string, userId: string, role: string) {
        await this.getById(id, userId, role);
        const history = await prisma.testCaseHistory.findMany({
            where: { testCaseId: id },
            orderBy: { version: 'desc' },
            include: {
                changedBy: { select: { firstName: true, lastName: true } },
            },
        });
        return history;
    }

    async move(id: string, targetSuiteId: string, userId: string, role: string) {
        const testCase = await this.getById(id, userId, role);
        const currentSuiteId = testCase.suiteId;

        if (currentSuiteId === targetSuiteId) {
            return testCase as any; // No change needed
        }

        // Check verification for target suite
        const targetSuite = await prisma.testSuite.findUnique({
            where: { id: targetSuiteId },
        });

        if (!targetSuite) {
            throw new AppError('Target suite not found', 404);
        }

        // Verify user has access to the target project
        await ProjectAccess.check(targetSuite.projectId, userId, role);

        // Also ensure target project is the same as source (Optional constraint, but usually safe)
        if (targetSuite.projectId !== testCase.suite.projectId) {
            throw new AppError('Cannot move test case to a different project', 400);
        }

        const currentSteps = (testCase as any).steps || [];

        // Create history entry
        await prisma.testCaseHistory.create({
            data: {
                testCaseId: testCase.id,
                version: testCase.version,
                title: testCase.title,
                steps: currentSteps,
                preconditions: testCase.preconditions,
                changedById: userId,
            },
        });

        const updated = await prisma.testCase.update({
            where: { id },
            data: {
                suiteId: targetSuiteId,
                version: { increment: 1 },
            },
            include: {
                suite: { select: { name: true, projectId: true } }
            }
        });

        return updated;
    }

    async addTags(id: string, tagIds: string[], userId: string, role: string) {
        if (!Array.isArray(tagIds) || tagIds.length === 0) return;

        const testCase = await this.getById(id, userId, role);
        const normalizedTagIds = Array.from(new Set(
            tagIds.filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim().length > 0)
        ));

        if (normalizedTagIds.length !== tagIds.length) {
            throw new AppError('Invalid tagIds payload', 400);
        }

        const tags = await prisma.tag.findMany({
            where: { id: { in: normalizedTagIds } },
            select: { id: true, projectId: true },
        });

        if (tags.length !== normalizedTagIds.length) {
            throw new AppError('One or more tags not found', 404);
        }

        if (tags.some((tag) => tag.projectId !== testCase.suite.projectId)) {
            throw new AppError('Tags must belong to the same project as the test case', 400);
        }

        // Use createMany to ignore duplicates? createMany doesn't support skipDuplicates in SQLite but does in Postgres.
        // Prisma createMany skipDuplicates is available.
        // But TestCaseTag has composite ID.

        // We can loop or use createMany with skipDuplicates: true
        await prisma.testCaseTag.createMany({
            data: normalizedTagIds.map(tagId => ({
                testCaseId: id,
                tagId
            })),
            skipDuplicates: true
        });

        // Update updated_at of test case?
        // Maybe not strictly necessary for tags, but good for "something changed".
    }

    async removeTag(id: string, tagId: string, userId: string, role: string) {
        const testCase = await this.getById(id, userId, role);
        const tag = await prisma.tag.findUnique({
            where: { id: tagId },
            select: { projectId: true },
        });

        if (!tag) {
            throw new AppError('Tag not found', 404);
        }

        if (tag.projectId !== testCase.suite.projectId) {
            throw new AppError('Tag does not belong to the same project as the test case', 400);
        }

        await prisma.testCaseTag.delete({
            where: {
                testCaseId_tagId: {
                    testCaseId: id,
                    tagId
                }
            }
        });
    }


    async bulkDelete(ids: string[], userId: string, role: string, hardDelete: boolean) {
        const testCases = await this.getBulkProjectContext(ids);

        if (hardDelete) {
            for (const projectId of new Set(testCases.map((testCase) => testCase.suite.projectId))) {
                await dataGovernanceService.assertPermanentDeletionAllowed(projectId);
            }
            if (role !== 'ADMIN' && role !== 'TEAM_LEADER') {
                if (!testCases.every((testCase) => testCase.authorId === userId)) {
                    throw new AppError('You do not have permission to delete some of these test cases', 403);
                }
            }

            return prisma.testCase.deleteMany({
                where: { id: { in: ids } }
            });
        } else {
            if (role !== 'ADMIN' && role !== 'TEAM_LEADER' && !testCases.every((testCase) => testCase.authorId === userId)) {
                throw new AppError('You do not have permission to delete some of these test cases', 403);
            }

            return prisma.testCase.updateMany({
                where: { id: { in: ids } },
                data: { deletedAt: new Date() }
            });
        }
    }

    async bulkUpdateStatus(ids: string[], status: CaseStatus, userId: string, role: string) {
        const testCases = await this.getBulkProjectContext(ids);
        await ProjectAccess.check(testCases[0].suite.projectId, userId, role);

        if (status === 'APPROVED' && role !== 'ADMIN' && role !== 'TEAM_LEADER') {
            throw new AppError('Only Team Leaders and Admins can approve test cases', 403);
        }

        for (const testCase of testCases) {
            assertTestCaseTransition(testCase.status as any, status as any);
        }

        return prisma.testCase.updateMany({
            where: { id: { in: ids } },
            data: { status }
        });
    }
}

export const testCaseService = new TestCaseService();
