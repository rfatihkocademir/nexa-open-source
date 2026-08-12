import { AppError } from '../utils/AppError';
import prisma from '../utils/prisma';
import { releaseEligibilityService } from './releaseEligibility.service';

type MinimalBusinessRequest = {
    id: string;
    status: 'DRAFT' | 'ANALYZED' | 'APPROVED' | 'REJECTED' | string;
    aiAnalysis?: {
        status?: 'NEEDS_INFO' | 'COMPLETE' | string;
    } | null;
};

type ExecutionCaseRef = {
    id: string;
    title?: string | null;
    status?: string | null;
    projectId?: string | null;
};

type ExecutionCaseGateInput = {
    requestedIds: string[];
    resolvedCases: ExecutionCaseRef[];
    requiredProjectId?: string | null;
    actorId: string;
    projectId: string;
};

type ReleaseDecisionGateInput = {
    decisionType: 'SCOPE' | 'DELIVERY' | 'QUALITY' | 'RELEASE' | 'RISK';
    decisionOutcome: 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_MORE_INFO';
    candidate: {
        id: string;
        criticalOpenBugs?: number | null;
        failedRunItems?: number | null;
        blockedRunItems?: number | null;
        openRuns?: number | null;
        traceabilityGaps?: number | null;
        approvedTestCases?: number | null;
        totalTestCases?: number | null;
        openFollowUpItems?: number | null;
        openPullRequests?: number | null;
    };
    actorId: string;
    projectId: string;
};

export class WorkflowGateService {
    private async auditBlock(actorId: string, projectId: string, entityType: string, entityId: string, reason: string) {
        try {
            await prisma.auditLog.create({
                data: {
                    actorId,
                    projectId,
                    action: 'GATE_BLOCKED',
                    entityType,
                    entityId,
                    after: { reason }
                }
            });
        } catch (err) {
            console.error('Failed to write audit log for gate block', err);
        }
        throw new AppError(`Workflow Gate Blocked: ${reason}`, 409);
    }

    async assertBusinessRequestReadyForApproval(request: MinimalBusinessRequest, epics: unknown[], actorId: string, projectId: string) {
        if (request.status === 'APPROVED') {
            await this.auditBlock(actorId, projectId, 'BusinessRequest', request.id, 'Business request is already approved');
        }

        if (request.status !== 'ANALYZED') {
            await this.auditBlock(actorId, projectId, 'BusinessRequest', request.id, 'Analysis must be completed before backlog generation approval');
        }

        const analysisStatus = request.aiAnalysis?.status;
        if (analysisStatus !== 'COMPLETE') {
            await this.auditBlock(actorId, projectId, 'BusinessRequest', request.id, 'Backlog generation is blocked until AI analysis status is COMPLETE');
        }

        if (!Array.isArray(epics) || epics.length === 0) {
            await this.auditBlock(actorId, projectId, 'BusinessRequest', request.id, 'Backlog generation is blocked because there are no analyzed epics to approve');
        }
    }

    async assertTestCasesReadyForExecution(input: ExecutionCaseGateInput) {
        const requestedIds = Array.from(new Set((input.requestedIds || []).filter(Boolean)));
        if (requestedIds.length === 0) {
            throw new AppError('At least one test case is required for execution', 400); // Not a gate block per se, just invalid input
        }

        const resolvedIds = new Set(input.resolvedCases.map((testCase) => testCase.id));
        const missingIds = requestedIds.filter((id) => !resolvedIds.has(id));
        if (missingIds.length > 0) {
            await this.auditBlock(input.actorId, input.projectId, 'TestCaseExecution', 'multiple', `Execution is blocked because some test cases are missing or deleted: ${missingIds.join(', ')}`);
        }

        if (input.requiredProjectId) {
            const outOfProject = input.resolvedCases.filter((testCase) => testCase.projectId !== input.requiredProjectId);
            if (outOfProject.length > 0) {
                await this.auditBlock(input.actorId, input.projectId, 'TestCaseExecution', 'multiple', 'Execution is blocked because selected test cases do not belong to the run project');
            }
        }

        const nonApproved = input.resolvedCases.filter((testCase) => testCase.status !== 'APPROVED');
        if (nonApproved.length > 0) {
            const labels = nonApproved
                .slice(0, 5)
                .map((testCase) => testCase.title || testCase.id)
                .join(', ');
            const overflow = nonApproved.length > 5 ? ` (+${nonApproved.length - 5} more)` : '';
            await this.auditBlock(input.actorId, input.projectId, 'TestCaseExecution', 'multiple', `Execution is blocked because only APPROVED test cases can run: ${labels}${overflow}`);
        }
    }

    async assertReleaseDecisionAllowed(input: ReleaseDecisionGateInput) {
        if (!(input.decisionType === 'RELEASE' && input.decisionOutcome === 'APPROVED')) {
            return;
        }

        const report = await releaseEligibilityService.evaluate(input.candidate.id);

        if (!report.isEligible) {
            await this.auditBlock(input.actorId, input.projectId, 'ReleaseCandidate', input.candidate.id, report.blockers.join('; '));
        }
    }

    async assertWorkItemReadyForDevelopment(workItem: { id: string, itemType: string, description?: string | null, parentId?: string | null }, actorId: string, projectId: string) {
        if (!workItem.description || workItem.description.trim() === '') {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItem.id, 'Development cannot start: Description is required.');
        }
        if (workItem.itemType === 'STORY' && !workItem.parentId) {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItem.id, 'Development cannot start: Story must be linked to an Epic.');
        }
    }

    async assertWorkItemReadyForQA(workItem: { id: string, itemType: string }, testCasesCount: number, openPRCount: number, actorId: string, projectId: string) {
        const blockers: string[] = [];
        if (['STORY', 'BUG', 'TASK'].includes(workItem.itemType) && testCasesCount === 0) {
            blockers.push('No linked TestCases found. Test design must be completed.');
        }
        if (openPRCount > 0) {
            blockers.push(`There are ${openPRCount} open pull requests. Code review must be approved.`);
        }

        if (blockers.length > 0) {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItem.id, blockers.join(' '));
        }
    }

    async assertWorkItemReadyForDone(workItem: { id: string, itemType: string }, actorId: string, projectId: string) {
        // Fetch test cases and their runs
        const testCases = await prisma.testCase.findMany({
            where: { workItemId: workItem.id, deletedAt: null },
            include: { runItems: { select: { finalStatus: true } } }
        });

        if (testCases.length > 0) {
            const hasFailures = testCases.some(tc => tc.runItems.some(ri => ri.finalStatus === 'FAIL' || ri.finalStatus === 'BLOCK'));
            if (hasFailures) {
                await this.auditBlock(actorId, projectId, 'WorkItem', workItem.id, 'Cannot complete work item: Some test cases have FAILED or BLOCKED results. Please resolve bugs first.');
            }
        }
    }

    /**
     * Gate: Story cannot start (move to IN_PROGRESS) without a linked and APPROVED requirement.
     * Enforces the bridge between spec and code.
     */
    async assertWorkItemHasApprovedRequirement(
        workItemId: string,
        itemType: string,
        requirementId: string | null,
        actorId: string,
        projectId: string
    ) {
        if (itemType !== 'STORY') return; // For now, only enforce for Stories

        if (!requirementId) {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItemId, 'Development blocked: Story must be linked to a technical Requirement.');
        }

        const requirement = await prisma.requirement.findUnique({
            where: { id: requirementId! },
            select: { status: true }
        });

        if (!requirement) {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItemId, 'Development blocked: Linked requirement not found.');
        }

        if (requirement?.status !== 'APPROVED') {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItemId, `Development blocked: Linked requirement is in ${requirement?.status} state. Spec must be APPROVED before development.`);
        }
    }

    async assertBugTraceability(workItem: { id: string, testResultId?: string | null, foundInEnvId?: string | null, status?: string | null }, actorId: string, projectId: string) {
        // Only enforce traceability for BUG type when it's not DRAFT or TODO (moving towards active work)
        if (workItem.status === 'TODO' || workItem.status === 'DRAFT') {
            return;
        }

        if (!workItem.testResultId && !workItem.foundInEnvId) {
            await this.auditBlock(actorId, projectId, 'WorkItem', workItem.id, 'Bug traceability is missing: Every bug must be linked to a Test Result OR an Environment where it was found.');
        }
    }

    async assertReleaseTraceability(candidate: { id: string, sourceRequestId?: string | null, totalWorkItems?: number | null }, actorId: string, projectId: string) {
        if (!candidate.sourceRequestId && (candidate.totalWorkItems ?? 0) === 0) {
            await this.auditBlock(actorId, projectId, 'ReleaseCandidate', candidate.id, 'Release traceability missing: Candidate must be linked to a Requirement (BusinessRequest) or contain work items.');
        }
    }

    /**
     * Gate: Code review must be completed (no open PRs) before QA execution can start.
     * Blocks the READY_FOR_TEST → QA transition if there are unmerged pull requests.
     */
    async assertCodeReviewApprovedForQA(
        workItem: { id: string; itemType: string },
        actorId: string,
        projectId: string
    ) {
        const openPRs = await prisma.pullRequest.count({
            where: {
                workItemId: workItem.id,
                state: 'open',
            },
        });

        if (openPRs > 0) {
            await this.auditBlock(
                actorId,
                projectId,
                'WorkItem',
                workItem.id,
                `QA cannot start: ${openPRs} open pull request(s) must be reviewed and merged before testing.`
            );
        }
    }

    /**
     * Gate: UAT must be completed and passed before production deployment.
     * Ensures at least one completed test run exists with a passing rate above threshold.
     */
    async assertUATApprovedForDeploy(
        releaseId: string,
        actorId: string,
        projectId: string
    ) {
        const release = await prisma.releaseCandidate.findUnique({
            where: { id: releaseId },
            include: {
                runLinks: {
                    include: {
                        testRun: {
                            select: {
                                id: true,
                                status: true,
                                totalItems: true,
                                passedCount: true,
                                failedCount: true,
                            },
                        },
                    },
                },
            },
        });

        if (!release) {
            await this.auditBlock(actorId, projectId, 'ReleaseCandidate', releaseId, 'Release candidate not found.');
            return;
        }

        const completedRuns = release.runLinks
            .map((rl) => rl.testRun)
            .filter((run) => run.status === 'COMPLETED');

        if (completedRuns.length === 0) {
            await this.auditBlock(
                actorId,
                projectId,
                'ReleaseCandidate',
                releaseId,
                'Production deployment is blocked: At least one UAT test run must be COMPLETED before deploy.'
            );
        }

        const hasFailures = completedRuns.some((run) => run.failedCount > 0);
        if (hasFailures) {
            await this.auditBlock(
                actorId,
                projectId,
                'ReleaseCandidate',
                releaseId,
                'Production deployment is blocked: Completed UAT runs contain failed test items. All failures must be resolved.'
            );
        }
    }

    /**
     * Gate: Test design must be completed before test execution can start.
     * Ensures the project has at least one approved test case for the targeted scope.
     */
    async assertTestDesignCompletedForExecution(
        projectId: string,
        workItemIds: string[],
        actorId: string
    ) {
        if (workItemIds.length === 0) return;

        const linkedTestCases = await prisma.testCase.count({
            where: {
                workItemId: { in: workItemIds },
                status: 'APPROVED',
                deletedAt: null,
            },
        });

        if (linkedTestCases === 0) {
            await this.auditBlock(
                actorId,
                projectId,
                'TestExecution',
                'scope',
                `Test execution is blocked: No approved test cases found for the ${workItemIds.length} work item(s) in scope. Test design must be completed first.`
            );
        }
    }
}

export const workflowGateService = new WorkflowGateService();
