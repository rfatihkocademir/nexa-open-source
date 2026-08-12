import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { CreateTestRunInput } from '../validations/testRun.validation';
import { ProjectAccess } from '../utils/projectAccess';
import { RunStatus, Prisma, ResultStatus, EnvironmentType } from '@prisma/client';
import { environmentService } from './environment.service';
import { testRunExecutionService } from './testRunExecution.service';
import { notificationService, NotificationType } from './notification.service';
import { assertTestRunTransition } from '../utils/stateMachine';
import { runInBackground } from '../utils/backgroundTask';
import { createLogger } from '../utils/logger';
import { workflowGateService } from './workflowGate.service';

const logger = createLogger('TestRunLifecycleService');

interface NormalizedStep {
    action: string;
    expected: string;
    expectedResult: string;
    type: string;
    order: number;
    [key: string]: any;
}

type TestCaseWithSteps = Prisma.TestCaseGetPayload<{
    include: {
        testCaseSteps: {
            include: { testStep: true }
        }
    }
}>;

export class TestRunLifecycleService {
    private normalizeSnapshotSteps(testCase: any): NormalizedStep[] {
        const relationalSteps = (testCase as TestCaseWithSteps)?.testCaseSteps?.map(ts => ts.testStep) || [];
        const sourceSteps = relationalSteps.length > 0
            ? relationalSteps
            : Array.isArray((testCase as any)?.steps)
                ? (testCase as any).steps
                : [];

        return sourceSteps.map((step: any, index: number) => ({
            ...step,
            action: step?.action || step?.name || '',
            expected: step?.expected || step?.expectedResult || '',
            expectedResult: step?.expectedResult || step?.expected || '',
            type: step?.type || 'MANUAL',
            order: step?.order || index + 1,
        }));
    }

    private hasAutomation(steps: NormalizedStep[]): boolean {
        return steps.some(step => step.type === 'WEB' || step.type === 'MOBILE');
    }

    async create(data: CreateTestRunInput, creatorId: string, role: string) {
        if (data.projectId) {
            await ProjectAccess.check(data.projectId, creatorId, role);
            const project = await prisma.project.findUnique({
                where: { id: data.projectId },
            });
            if (!project) {
                throw new AppError('Project not found', 404);
            }
        }

        const casesToInclude = await this.fetchCasesToInclude(data, creatorId);

        let environmentId = (data as any).environmentId;
        if (!environmentId && data.projectId && (data as any).environment) {
            const env = await environmentService.findOrCreateByName(data.projectId, String((data as any).environment));
            environmentId = env.id;
        }

        const testRun = await prisma.$transaction(async (tx) => {
            const keyedProject = data.projectId
                ? await (tx.project as any).update({
                    where: { id: data.projectId },
                    data: { nextTestRunNumber: { increment: 1 } },
                    select: { key: true, nextTestRunNumber: true },
                })
                : null;
            const sequenceNumber = keyedProject ? keyedProject.nextTestRunNumber - 1 : Date.now();
            const run = await (tx.testRun as any).create({
                data: {
                    key: keyedProject ? `${keyedProject.key}-TR-${sequenceNumber}` : `RUN-TR-${sequenceNumber}`,
                    sequenceNumber,
                    title: data.title,
                    projectId: data.projectId || null,
                    milestoneId: data.milestoneId,
                    creatorId: creatorId,
                    status: RunStatus.OPEN,
                    environmentId,
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                    totalItems: casesToInclude.length,
                    untestedCount: casesToInclude.length,
                },
            });

            if (casesToInclude.length > 0) {
                await tx.testRunItem.createMany({
                    data: casesToInclude.map(testCase => {
                        const caseSteps = this.normalizeSnapshotSteps(testCase);
                        const hasAutomationSteps = this.hasAutomation(caseSteps);

                        return {
                            testRunId: run.id,
                            testCaseId: testCase.id,
                            caseTitle: testCase.title,
                            caseSteps: caseSteps as any,
                            casePreconditions: testCase.preconditions,
                            casePriority: testCase.priority,
                            assigneeId: testCase.authorId,
                            manualStatus: ResultStatus.UNTESTED,
                            automationStatus: hasAutomationSteps ? ResultStatus.UNTESTED : null,
                            finalStatus: ResultStatus.UNTESTED,
                        };
                    }),
                });
            }

            return run;
        });

        if (data.projectId) {
            notificationService.notifyProject(data.projectId, {
                type: NotificationType.TEST_RUN_ASSIGNED,
                title: 'notifications.test_run_created_title',
                message: 'notifications.test_run_created_message',
                data: {
                    testRunId: testRun.id,
                    title: testRun.title,
                    dueDate: testRun.dueDate
                }
            });
        }

        return testRun;
    }

    private async fetchCasesToInclude(data: CreateTestRunInput, actorId: string): Promise<TestCaseWithSteps[]> {
        const select = {
            id: true,
            title: true,
            status: true,
            steps: true,
            testCaseSteps: {
                include: { testStep: true },
                orderBy: { orderIndex: 'asc' } as const
            },
            preconditions: true,
            priority: true,
            authorId: true,
            suite: {
                select: {
                    projectId: true,
                },
            },
        };

        if (data.includeAllCases && data.projectId) {
            return await prisma.testCase.findMany({
                where: {
                    suite: { projectId: data.projectId },
                    status: 'APPROVED',
                    deletedAt: null,
                },
                select
            }) as unknown as TestCaseWithSteps[];
        } else if (data.testCaseIds) {
            const requestedIds = Array.from(new Set(data.testCaseIds.filter(Boolean)));
            const selectedCases = await prisma.testCase.findMany({
                where: {
                    id: { in: requestedIds },
                    deletedAt: null,
                    suite: data.projectId
                        ? { projectId: data.projectId }
                        : undefined,
                },
                select
            }) as unknown as TestCaseWithSteps[];

            await workflowGateService.assertTestCasesReadyForExecution({
                requestedIds,
                resolvedCases: selectedCases.map((testCase: any) => ({
                    id: testCase.id,
                    title: testCase.title,
                    status: testCase.status,
                    projectId: testCase.suite?.projectId,
                })),
                requiredProjectId: data.projectId || null,
                actorId,
                projectId: data.projectId || 'system',
            });

            return selectedCases;
        }
        return [];
    }

    async addItems(testRunId: string, testCaseIds: string[], userId: string, role: string) {
        const run = await prisma.testRun.findUnique({ where: { id: testRunId } });
        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        const cases = await prisma.testCase.findMany({
            where: {
                id: { in: testCaseIds },
                deletedAt: null,
                suite: run.projectId
                    ? { projectId: run.projectId }
                    : undefined,
            },
            select: {
                id: true,
                title: true,
                status: true,
                steps: true,
                testCaseSteps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                },
                preconditions: true,
                priority: true,
                authorId: true,
                suite: {
                    select: {
                        projectId: true,
                    },
                },
            }
        }) as unknown as TestCaseWithSteps[];

        await workflowGateService.assertTestCasesReadyForExecution({
            requestedIds: testCaseIds,
            resolvedCases: cases.map((testCase: any) => ({
                id: testCase.id,
                title: testCase.title,
                status: testCase.status,
                projectId: testCase.suite?.projectId,
            })),
            requiredProjectId: run.projectId || null,
            actorId: userId,
            projectId: run.projectId || 'system',
        });

        if (cases.length === 0) {
            return;
        }

        const existingItems = await prisma.testRunItem.findMany({
            where: {
                testRunId: run.id,
                testCaseId: { in: cases.map(c => c.id) }
            },
            select: { testCaseId: true }
        });
        const existingCaseIds = new Set(existingItems.map(i => i.testCaseId));
        const newCases = cases.filter(c => !existingCaseIds.has(c.id));

        if (newCases.length === 0) {
            return;
        }

        await prisma.testRunItem.createMany({
            data: newCases.map(testCase => {
                const caseSteps = this.normalizeSnapshotSteps(testCase);
                const hasAutomationSteps = this.hasAutomation(caseSteps);

                return {
                    testRunId: run.id,
                    testCaseId: testCase.id,
                    caseTitle: testCase.title,
                    caseSteps: caseSteps as any,
                    casePreconditions: testCase.preconditions,
                    casePriority: testCase.priority,
                    assigneeId: testCase.authorId,
                    manualStatus: ResultStatus.UNTESTED,
                    automationStatus: hasAutomationSteps ? ResultStatus.UNTESTED : null,
                    finalStatus: ResultStatus.UNTESTED,
                };
            }),
        });

        await prisma.testRun.update({
            where: { id: testRunId },
            data: {
                totalItems: { increment: newCases.length },
                untestedCount: { increment: newCases.length },
            }
        });

        if (run.projectId) {
            const uniqueAssignees = [...new Set(cases.map(c => c.authorId).filter(Boolean))];
            for (const assigneeId of uniqueAssignees) {
                if (assigneeId && assigneeId !== userId) {
                    notificationService.notifyUser(assigneeId, {
                        type: NotificationType.TEST_RUN_ITEMS_ADDED,
                        title: 'notifications.test_run_items_added_title',
                        message: 'notifications.test_run_items_added_message',
                        data: { testRunId, projectId: run.projectId, title: run.title }
                    });
                }
            }
        }

        runInBackground(() => testRunExecutionService.triggerAutomation(run.id, userId, role), (err) => {
            logger.error(`Failed to trigger automation for run ${run.id}:`, err);
        });
    }

    async createQuickRun(testCaseId: string, userId: string, role: string) {
        const testCase = await prisma.testCase.findUnique({
            where: { id: testCaseId },
            include: {
                suite: true,
                testCaseSteps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        }) as TestCaseWithSteps & { suite: { projectId: string } };

        if (!testCase) {
            throw new AppError('Test case not found', 404);
        }

        await ProjectAccess.check(testCase.suite.projectId, userId, role);
        await workflowGateService.assertTestCasesReadyForExecution({
            requestedIds: [testCase.id],
            resolvedCases: [{
                id: testCase.id,
                title: testCase.title,
                status: (testCase as any).status,
                projectId: testCase.suite.projectId,
            }],
            requiredProjectId: testCase.suite.projectId,
            actorId: userId,
            projectId: testCase.suite.projectId,
        });

        const dateStr = new Date().toLocaleString();
        const title = `Functional Test: ${testCase.title} - ${dateStr}`;

        const env = await environmentService.findOrCreateByName(testCase.suite.projectId, 'QA');

        const testRun = await prisma.$transaction(async (tx) => {
            const keyedProject = await (tx.project as any).update({
                where: { id: testCase.suite.projectId },
                data: { nextTestRunNumber: { increment: 1 } },
                select: { key: true, nextTestRunNumber: true },
            });
            const sequenceNumber = keyedProject.nextTestRunNumber - 1;
            const run = await (tx.testRun as any).create({
                data: {
                    key: `${keyedProject.key}-TR-${sequenceNumber}`,
                    sequenceNumber,
                    title: title,
                    projectId: testCase.suite.projectId,
                    creatorId: userId,
                    status: RunStatus.OPEN,
                    environmentId: env.id,
                },
            });

            const caseSteps = this.normalizeSnapshotSteps(testCase);
            const hasAutomationSteps = this.hasAutomation(caseSteps);

            await tx.testRunItem.create({
                data: {
                    testRunId: run.id,
                    testCaseId: testCase.id,
                    caseTitle: testCase.title,
                    caseSteps: caseSteps as any,
                    casePreconditions: testCase.preconditions,
                    casePriority: testCase.priority,
                    assigneeId: userId,
                    manualStatus: ResultStatus.UNTESTED,
                    automationStatus: hasAutomationSteps ? ResultStatus.UNTESTED : null,
                    finalStatus: ResultStatus.UNTESTED,
                }
            });

            await tx.testRun.update({
                where: { id: run.id },
                data: {
                    totalItems: 1,
                    untestedCount: 1,
                }
            });

            return run;
        });

        if (this.hasAutomation(this.normalizeSnapshotSteps(testCase))) {
            runInBackground(() => testRunExecutionService.triggerAutomation(testRun.id, userId, role), (err) => {
                logger.error(`Failed to trigger automation for quick run ${testRun.id}:`, err);
            });
        }

        return testRun;
    }

    async update(id: string, data: Partial<CreateTestRunInput> & { status?: string }, userId: string, role: string) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { projectId, testCaseIds, includeAllCases, milestoneId, status, ...rest } = data;

        const run = await prisma.testRun.findUnique({
            where: { id },
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }
if (status) {
    assertTestRunTransition(run.status as RunStatus, status as RunStatus);
}

const normalizedData: any = { ...rest };
let environmentId = normalizedData.environmentId;

if (!environmentId && normalizedData.environment && run.projectId) {
    const env = await environmentService.findOrCreateByName(run.projectId, String(normalizedData.environment));
    environmentId = env.id;
}
delete normalizedData.environment;

const updatedRun = await prisma.testRun.update({
    where: { id },
    data: {
        ...normalizedData,
        status: status ? (status as RunStatus) : undefined,
        environmentId,
        startDate: data.startDate !== undefined
            ? (data.startDate ? new Date(data.startDate) : null)
            : undefined,

                dueDate: data.dueDate !== undefined
                    ? (data.dueDate ? new Date(data.dueDate) : null)
                    : undefined,
            },
        });

        return updatedRun;
    }

    async delete(id: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({
            where: { id },
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        await prisma.testRun.delete({
            where: { id },
        });
    }

    async deleteItem(itemId: string, userId: string, role: string) {
        const item = await prisma.testRunItem.findUnique({
            where: { id: itemId },
            include: { testRun: true },
        });

        if (!item) {
            throw new AppError('Test run item not found', 404);
        }

        if (item.testRun?.projectId) {
            await ProjectAccess.check(item.testRun.projectId, userId, role);
        }

        if (item.finalStatus !== ResultStatus.UNTESTED) {
            throw new AppError('Cannot remove item that has already been executed', 400);
        }

        await prisma.testRunItem.delete({
            where: { id: itemId },
        });

        await prisma.testRun.update({
            where: { id: item.testRunId },
            data: {
                totalItems: { decrement: 1 },
                untestedCount: { decrement: 1 },
            },
        });
    }
}

export const testRunLifecycleService = new TestRunLifecycleService();
