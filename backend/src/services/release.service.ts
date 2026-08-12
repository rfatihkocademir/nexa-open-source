import { ReleaseStatus, DecisionType, DecisionOutcome } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { aiOrchestratorService, type ReleaseAISummary } from './ai-orchestrator.service';
import { workItemService } from './workitem.service';
import { workflowGateService } from './workflowGate.service';
import { assertReleaseTransition } from '../utils/stateMachine';

type CreateReleaseCandidateInput = {
    title: string;
    summary?: string;
    label?: string;
    sprintId?: string;
    milestoneId?: string;
    sourceRequestId?: string;
    testRunIds?: string[];
    workItemIds?: string[]; // New: Explicit scope support
};

type DecisionInput = {
    type: DecisionType;
    outcome: DecisionOutcome;
    rationale?: string;
    confidence?: number;
};

type ReleaseFollowUpInput = {
    itemType: 'BUG' | 'STORY' | 'TASK';
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceActionType: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
    sourceActionFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
};

const releaseCandidateInclude = {
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    sprint: { select: { id: true, name: true, status: true } },
    milestone: { select: { id: true, name: true, status: true } },
    sourceRequest: { select: { id: true, title: true, status: true } },
    decisions: {
        include: {
            author: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
    },
    runLinks: {
        include: {
            testRun: { select: { id: true, title: true, status: true } },
        },
    },
    followUps: {
        include: {
            workItem: { select: { id: true, title: true, itemType: true, status: true, priority: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
    },
} as const;

export class ReleaseService {
    private getReleaseCandidateModel() {
        const model = (prisma as any).releaseCandidate;
        if (!model) {
            throw new AppError('Release governance is unavailable in the current Prisma client', 503);
        }
        return model;
    }

    private getDecisionRecordModel() {
        const model = (prisma as any).decisionRecord;
        if (!model) {
            throw new AppError('Release governance is unavailable in the current Prisma client', 503);
        }
        return model;
    }

    private getReleaseFollowUpModel() {
        const model = (prisma as any).releaseFollowUp;
        if (!model) {
            throw new AppError('Release governance is unavailable in the current Prisma client', 503);
        }
        return model;
    }

    async listByProject(projectId: string, userId: string, role: string, includeArchived: boolean = false) {
        await ProjectAccess.check(projectId, userId, role);

        const releaseCandidateModel = (prisma as any).releaseCandidate;
        if (!releaseCandidateModel?.findMany) {
            return [];
        }

        const where: any = { projectId };
        if (!includeArchived) {
            where.deletedAt = null;
        }

        const candidates = await releaseCandidateModel.findMany({
            where,
            include: releaseCandidateInclude,
            orderBy: { createdAt: 'desc' },
        });
        return Promise.all(candidates.map((candidate: any) => this.enrichReleaseCandidate(candidate)));
    }

    async getById(projectId: string, releaseCandidateId: string, userId: string, role: string, includeArchived: boolean = false) {
        await ProjectAccess.check(projectId, userId, role);
        const where: any = { id: releaseCandidateId, projectId };
        if (!includeArchived) {
            where.deletedAt = null;
        }
        const candidate = await this.getReleaseCandidateModel().findFirst({
            where,
            include: releaseCandidateInclude,
        });

        if (!candidate) {
            throw new AppError('Release candidate not found', 404);
        }

        return this.enrichReleaseCandidate(candidate);
    }

    async update(projectId: string, releaseCandidateId: string, data: Partial<CreateReleaseCandidateInput>, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const candidate = await this.getById(projectId, releaseCandidateId, userId, role);

        return this.getReleaseCandidateModel().update({
            where: { id: releaseCandidateId },
            data: {
                title: data.title?.trim(),
                summary: data.summary?.trim(),
                label: data.label?.trim(),
                sprintId: data.sprintId,
                milestoneId: data.milestoneId,
            },
        });
    }

    async archive(projectId: string, id: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const candidate = await this.getById(projectId, id, userId, role);

        return this.getReleaseCandidateModel().update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async delete(projectId: string, id: string, userId: string, role: string) {
        return this.archive(projectId, id, userId, role);
    }

    async restore(projectId: string, id: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const candidate = await this.getReleaseCandidateModel().findFirst({
            where: { id, projectId },
        });

        if (!candidate) {
            throw new AppError('Release candidate not found', 404);
        }

        return this.getReleaseCandidateModel().update({
            where: { id },
            data: { deletedAt: null },
        });
    }

    async hardDelete(projectId: string, id: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const candidate = await this.getReleaseCandidateModel().findFirst({
            where: { id, projectId },
        });

        if (!candidate) {
            throw new AppError('Release candidate not found', 404);
        }

        return this.getReleaseCandidateModel().delete({
            where: { id },
        });
    }

    async create(projectId: string, input: CreateReleaseCandidateInput, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const requestedWorkItemIds = Array.from(new Set(input.workItemIds || []));
        const derivedWorkItemIds = requestedWorkItemIds.length === 0 && input.sourceRequestId
            ? (await prisma.workItem.findMany({
                where: { projectId, sourceRequestId: input.sourceRequestId, deletedAt: null },
                select: { id: true },
            })).map((item) => item.id)
            : [];
        const scopedWorkItemIds = requestedWorkItemIds.length > 0 ? requestedWorkItemIds : derivedWorkItemIds;

        if (scopedWorkItemIds.length > 0) {
            const scopedCount = await prisma.workItem.count({
                where: { projectId, id: { in: scopedWorkItemIds }, deletedAt: null },
            });
            if (scopedCount !== scopedWorkItemIds.length) {
                throw new AppError('One or more work items do not belong to this project', 400);
            }
        }
        if ((input.testRunIds || []).length > 0) {
            const runCount = await prisma.testRun.count({
                where: { projectId, id: { in: input.testRunIds } },
            });
            if (runCount !== new Set(input.testRunIds).size) {
                throw new AppError('One or more test runs do not belong to this project', 400);
            }
        }

        await workflowGateService.assertReleaseTraceability({
            id: 'new-candidate',
            sourceRequestId: input.sourceRequestId,
            totalWorkItems: scopedWorkItemIds.length
        }, userId, projectId);
        if (!input.title?.trim()) {
            throw new AppError('title is required', 400);
        }

        const candidate = await prisma.$transaction(async (tx) => {
            const keyedProject = await (tx.project as any).update({
                where: { id: projectId },
                data: { nextReleaseNumber: { increment: 1 } },
                select: { key: true, nextReleaseNumber: true },
            });
            const sequenceNumber = keyedProject.nextReleaseNumber - 1;

            return (tx.releaseCandidate as any).create({
                data: {
                key: `${keyedProject.key}-RC-${sequenceNumber}`,
                sequenceNumber,
                projectId,
                title: input.title.trim(),
                summary: input.summary?.trim() || null,
                label: input.label?.trim() || null,
                createdById: userId,
                sprintId: input.sprintId || null,
                milestoneId: input.milestoneId || null,
                sourceRequestId: input.sourceRequestId || null,
                runLinks: {
                    create: (input.testRunIds || []).map((testRunId) => ({
                        testRun: { connect: { id: testRunId } },
                    })),
                },
                workItemLinks: {
                    create: scopedWorkItemIds.map((workItemId) => ({
                        workItem: { connect: { id: workItemId } },
                    })),
                },
            },
                include: {
                    decisions: true,
                    runLinks: { include: { testRun: true } },
                },
            });
        });

        // Calculate metrics only after links exist; this keeps every release metric on
        // exactly the candidate's work-item and test-run scope.
        const metrics = await this.buildReleaseMetrics(projectId, input.testRunIds || [], candidate.id);
        await this.getReleaseCandidateModel().update({ where: { id: candidate.id }, data: metrics });
        return this.getById(projectId, candidate.id, userId, role);
    }

    async addDecision(projectId: string, releaseCandidateId: string, input: DecisionInput, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const candidate = await this.getById(projectId, releaseCandidateId, userId, role);

        await workflowGateService.assertReleaseDecisionAllowed({
            decisionType: input.type,
            decisionOutcome: input.outcome,
            actorId: userId,
            projectId: projectId,
            candidate: {
                id: candidate.id,
                criticalOpenBugs: candidate.criticalOpenBugs,
                failedRunItems: candidate.failedRunItems,
                blockedRunItems: candidate.blockedRunItems,
                openRuns: candidate.openRuns,
                traceabilityGaps: candidate.traceabilityGaps,
                approvedTestCases: candidate.approvedTestCases,
                totalTestCases: candidate.totalTestCases,
                openFollowUpItems: candidate.openFollowUpItems,
                openPullRequests: candidate.openPullRequests,
            },
        });

        await this.getDecisionRecordModel().create({
            data: {
                releaseCandidateId,
                type: input.type,
                outcome: input.outcome,
                rationale: input.rationale?.trim() || null,
                confidence: input.confidence ?? null,
                authorId: userId,
            },
        });

        const decisions = await this.getDecisionRecordModel().findMany({
            where: { releaseCandidateId },
            orderBy: { createdAt: 'desc' },
        });

        const status = this.deriveReleaseStatus(decisions);

        await this.getReleaseCandidateModel().update({
            where: { id: releaseCandidateId },
            data: { status },
        });

        return this.getById(projectId, releaseCandidateId, userId, role);
    }

    async updateStatus(projectId: string, releaseCandidateId: string, status: ReleaseStatus, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const candidate = await this.getById(projectId, releaseCandidateId, userId, role);

        assertReleaseTransition(candidate.status as ReleaseStatus, status);

        // Business Rule: No critical bugs allowed for READY state
        if (status === 'READY' && (candidate.criticalOpenBugs ?? 0) > 0) {
            throw new AppError('Kritik hatalar çözülmeden sürüm hazır durumuna getirilemez', 400);
        }

        return this.getReleaseCandidateModel().update({
            where: { id: releaseCandidateId },
            data: { status },
        });
    }

    async createFollowUp(projectId: string, releaseCandidateId: string, input: ReleaseFollowUpInput, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const candidate = await this.getReleaseCandidateModel().findFirst({
            where: { id: releaseCandidateId, projectId },
            select: { id: true, title: true },
        });

        if (!candidate) {
            throw new AppError('Release candidate not found', 404);
        }

        const workItem = await workItemService.create({
            projectId,
            itemType: input.itemType,
            title: input.title,
            description: input.description,
            priority: input.itemType === 'BUG' ? input.severity || input.priority || 'HIGH' : input.priority || 'MEDIUM',
            severity: input.itemType === 'BUG' ? input.severity || 'HIGH' : undefined,
            reporterId: userId,
            status: 'TODO',
        });

        await this.getReleaseFollowUpModel().create({
            data: {
                releaseCandidateId,
                workItemId: workItem.id,
                sourceActionType: input.sourceActionType,
                sourceActionFocus: input.sourceActionFocus,
                createdById: userId,
            },
        });

        return this.getById(projectId, releaseCandidateId, userId, role);
    }

    async getAISummary(projectId: string, releaseCandidateId: string, userId: string, role: string): Promise<ReleaseAISummary> {
        const candidate = await this.getById(projectId, releaseCandidateId, userId, role);
        return aiOrchestratorService.buildReleaseSummary({
            readinessScore: candidate.readinessScore ?? 0,
            totalWorkItems: candidate.totalWorkItems ?? 0,
            completedWorkItems: candidate.completedWorkItems ?? 0,
            openBugs: candidate.openBugs ?? 0,
            criticalOpenBugs: candidate.criticalOpenBugs ?? 0,
            approvedTestCases: candidate.approvedTestCases ?? 0,
            totalTestCases: candidate.totalTestCases ?? 0,
            openRuns: candidate.openRuns ?? 0,
            failedRunItems: candidate.failedRunItems ?? 0,
            blockedRunItems: candidate.blockedRunItems ?? 0,
            conflictRunItems: candidate.conflictRunItems ?? 0,
            traceabilityGaps: candidate.traceabilityGaps ?? 0,
            openFollowUpItems: candidate.openFollowUpItems ?? 0,
            completedFollowUpItems: candidate.completedFollowUpItems ?? 0,
            linkedCommits: candidate.linkedCommits ?? 0,
            openPullRequests: candidate.openPullRequests ?? 0,
            mergedPullRequests: candidate.mergedPullRequests ?? 0,
        });
    }

    private async buildReleaseMetrics(projectId: string, explicitRunIds: string[], releaseId?: string) {
        const itemScopeFilter = releaseId
            ? { releaseLinks: { some: { releaseCandidateId: releaseId } } }
            : { id: { in: [] as string[] } };
        const runScopeFilter = releaseId
            ? { releaseLinks: { some: { releaseCandidateId: releaseId } } }
            : { id: { in: explicitRunIds } };

        const [
            totalWorkItems,
            completedWorkItems,
            openBugs,
            criticalOpenBugs,
            traceabilityGaps,
            totalTestCases,
            approvedTestCases,
            openRuns,
            failedRunItems,
            blockedRunItems,
            conflictRunItems,
        ] = await Promise.all([
            prisma.workItem.count({ where: itemScopeFilter }),
            prisma.workItem.count({ where: { ...itemScopeFilter, status: 'DONE' } }),
            prisma.workItem.count({ where: { ...itemScopeFilter, itemType: 'BUG', status: { notIn: ['DONE', 'CLOSED'] } } }),
            prisma.workItem.count({ where: { ...itemScopeFilter, itemType: 'BUG', status: { notIn: ['DONE', 'CLOSED'] }, severity: 'CRITICAL' } }),
            prisma.workItem.count({
                where: {
                    ...itemScopeFilter,
                    itemType: 'STORY',
                    testCases: { none: {} },
                },
            }),
            prisma.testCase.count({ where: { workItem: itemScopeFilter, deletedAt: null } }),
            prisma.testCase.count({ where: { workItem: itemScopeFilter, deletedAt: null, status: 'APPROVED' } }),
            prisma.testRun.count({ where: { projectId, status: 'OPEN', ...runScopeFilter } }),
            prisma.testRunItem.count({ where: { testRun: { projectId, ...runScopeFilter }, finalStatus: 'FAIL' } }),
            prisma.testRunItem.count({ where: { testRun: { projectId, ...runScopeFilter }, finalStatus: 'BLOCK' } }),
            prisma.testRunItem.count({ where: { testRun: { projectId, ...runScopeFilter }, finalStatus: 'CONFLICT' } }),
        ]);

        const [linkedCommits, openPullRequests, mergedPullRequests] = await Promise.all([
            prisma.gitCommit.count({ where: { projectId } }),
            prisma.pullRequest.count({ where: { projectId, state: 'open' } }),
            prisma.pullRequest.count({ where: { projectId, mergedAt: { not: null } } }),
        ]);

        const readinessScore = this.calculateReadinessScore({
            totalWorkItems,
            completedWorkItems,
            openBugs,
            criticalOpenBugs,
            traceabilityGaps,
            totalTestCases,
            approvedTestCases,
            failedRunItems,
            blockedRunItems,
            conflictRunItems,
            openPullRequests,
        });

        return {
            totalWorkItems,
            completedWorkItems,
            openBugs,
            criticalOpenBugs,
            totalTestCases,
            approvedTestCases,
            openRuns,
            failedRunItems,
            blockedRunItems,
            conflictRunItems,
            traceabilityGaps,
            readinessScore,
            linkedCommits,
            openPullRequests,
            mergedPullRequests,
        };
    }

    private calculateReadinessScore(input: {
        totalWorkItems: number;
        completedWorkItems: number;
        openBugs: number;
        criticalOpenBugs: number;
        totalTestCases: number;
        approvedTestCases: number;
        failedRunItems: number;
        blockedRunItems: number;
        conflictRunItems: number;
        traceabilityGaps: number;
        openPullRequests?: number;
        openFollowUpItems?: number;
    }) {
        const completionRatio = input.totalWorkItems > 0 ? input.completedWorkItems / input.totalWorkItems : 1;
        const coverageRatio = input.totalTestCases > 0 ? input.approvedTestCases / input.totalTestCases : 0.5;
        const bugPenalty = input.criticalOpenBugs * 15 + input.openBugs * 4;
        const runPenalty = input.failedRunItems * 3 + input.blockedRunItems * 4 + input.conflictRunItems * 5;
        const traceabilityPenalty = input.traceabilityGaps * 4;
        const codeReviewPenalty = (input.openPullRequests ?? 0) * 3;
        const followUpPenalty = (input.openFollowUpItems ?? 0) * 6;
        const raw = completionRatio * 50 + coverageRatio * 40 + 10 - bugPenalty - runPenalty - traceabilityPenalty - codeReviewPenalty - followUpPenalty;
        return Math.max(0, Math.min(100, Math.round(raw)));
    }

    private async enrichReleaseCandidate(candidate: any) {
        const followUps = candidate.followUps || [];
        const [linkedCommits, openPullRequests, mergedPullRequests] = await Promise.all([
            prisma.gitCommit.count({ where: { projectId: candidate.projectId } }),
            prisma.pullRequest.count({ where: { projectId: candidate.projectId, state: 'open' } }),
            prisma.pullRequest.count({ where: { projectId: candidate.projectId, mergedAt: { not: null } } }),
        ]);
        const completedStatuses = new Set(['DONE', 'CLOSED', 'FIXED']);
        const completedFollowUpItems = followUps.filter((followUp: any) => completedStatuses.has(followUp.workItem?.status)).length;
        const openFollowUpItems = followUps.length - completedFollowUpItems;
        const nextReadinessScore = this.calculateReadinessScore({
            totalWorkItems: candidate.totalWorkItems,
            completedWorkItems: candidate.completedWorkItems,
            openBugs: candidate.openBugs,
            criticalOpenBugs: candidate.criticalOpenBugs,
            totalTestCases: candidate.totalTestCases,
            approvedTestCases: candidate.approvedTestCases,
            failedRunItems: candidate.failedRunItems,
            blockedRunItems: candidate.blockedRunItems,
            conflictRunItems: candidate.conflictRunItems,
            traceabilityGaps: candidate.traceabilityGaps,
            openPullRequests,
            openFollowUpItems,
        });

        if (candidate.readinessScore !== nextReadinessScore) {
            await (prisma as any).releaseCandidate.update({
                where: { id: candidate.id },
                data: { readinessScore: nextReadinessScore },
            });
        }

        return {
            ...candidate,
            readinessScore: nextReadinessScore,
            openFollowUpItems,
            completedFollowUpItems,
            linkedCommits,
            openPullRequests,
            mergedPullRequests,
        };
    }

    private deriveReleaseStatus(decisions: Array<{ type: DecisionType; outcome: DecisionOutcome }>): ReleaseStatus {
        const latestByType = new Map<DecisionType, DecisionOutcome>();
        for (const decision of decisions) {
            if (!latestByType.has(decision.type)) {
                latestByType.set(decision.type, decision.outcome);
            }
        }

        const scope = latestByType.get('SCOPE');
        const delivery = latestByType.get('DELIVERY');
        const quality = latestByType.get('QUALITY');

        if (!scope && !delivery && !quality) {
            return 'DRAFT';
        }

        const outcomes = [scope, delivery, quality].filter(Boolean) as DecisionOutcome[];
        
        // If any critical area is rejected, it's back to DRAFT (not ready)
        if (outcomes.some((outcome) => outcome === 'REJECTED')) {
            return 'DRAFT';
        }
        
        // All core areas must be approved for it to be READY
        if (outcomes.length === 3 && outcomes.every((outcome) => outcome === 'APPROVED')) {
            return 'READY';
        }

        return 'DRAFT';
    }
}

export const releaseService = new ReleaseService();
