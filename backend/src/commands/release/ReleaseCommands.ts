import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { commandBus } from '../../core/bus/CommandBus';
import { ReleaseStatus, DecisionType, DecisionOutcome } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { workflowGateService } from '../../services/workflowGate.service';
import { releaseEligibilityService } from '../../services/releaseEligibility.service';

/**
 * Command to create a new Release Candidate.
 */
export class CreateReleaseCandidateCommand implements ICommand {
    readonly commandName = 'CreateReleaseCandidate';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: {
            title: string;
            summary?: string;
            label?: string;
            projectId: string;
            sprintId?: string;
            milestoneId?: string;
            sourceRequestId?: string;
            testRunIds?: string[];
            workItemIds?: string[]; // Explicit scope
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'ReleaseCandidate',
            projectId: this.data.projectId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'create' };
    }
}

/**
 * Command to add a decision record to a Release Candidate.
 */
export class AddReleaseDecisionCommand implements ICommand {
    readonly commandName = 'AddReleaseDecision';
    
    constructor(
        public readonly context: CommandContext,
        public readonly releaseId: string,
        public readonly data: {
            type: DecisionType;
            outcome: DecisionOutcome;
            rationale?: string;
            confidence?: number;
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'ReleaseCandidate',
            resourceId: this.releaseId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }

    async checkGates(): Promise<void> {
        // Enforce readiness checks before allowing certain decisions
        if (this.data.outcome === 'APPROVED') {
            const release = await prisma.releaseCandidate.findUnique({
                where: { id: this.releaseId },
                include: { workItemLinks: { include: { workItem: true } } }
            });
            
            if (!release) throw new AppError('Release Candidate not found', 404);

            // Gate: Cannot approve QUALITY if critical bugs exist in scope
            if (this.data.type === 'QUALITY') {
                const criticalBugs = await prisma.workItem.count({
                    where: {
                        releaseLinks: { some: { releaseCandidateId: this.releaseId } },
                        itemType: 'BUG',
                        priority: 'CRITICAL',
                        status: { notIn: ['DONE', 'CLOSED', 'FIXED'] }
                    }
                });
                
                if (criticalBugs > 0) {
                    throw new AppError(`Quality Approval Blocked: There are ${criticalBugs} critical bugs in this release scope.`, 409);
                }
            }
        }
    }
}

/**
 * Command to explicitly transition Release Candidate status.
 */
export class UpdateReleaseStatusCommand implements ICommand {
    readonly commandName = 'UpdateReleaseStatus';
    
    constructor(
        public readonly context: CommandContext,
        public readonly id: string,
        public readonly nextStatus: ReleaseStatus
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'ReleaseCandidate',
            resourceId: this.id,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }

    async checkGates(): Promise<void> {
        if (this.nextStatus === 'READY' || this.nextStatus === 'RELEASED') {
            const evaluation = await releaseEligibilityService.evaluate(this.id);
            
            if (!evaluation.isEligible) {
                const reason = evaluation.blockers.join(' | ');
                throw new AppError(`Release Blockage (Eligibility Failure): ${reason}`, 409);
            }

            if (this.nextStatus === 'READY' && evaluation.readinessScore < 80) {
                 throw new AppError(`Release Blockage: Readiness score (${evaluation.readinessScore}) is below hard-lock threshold (80).`, 409);
            }
        }
    }
}

/**
 * Command to create a follow-up item for a Release Candidate.
 */
export class CreateReleaseFollowUpCommand implements ICommand {
    readonly commandName = 'CreateReleaseFollowUp';
    
    constructor(
        public readonly context: CommandContext,
        public readonly releaseId: string,
        public readonly data: {
            itemType: 'BUG' | 'STORY' | 'TASK';
            title: string;
            description?: string;
            priority?: any;
            severity?: any;
            sourceActionType: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
            sourceActionFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'ReleaseCandidate',
            resourceId: this.releaseId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }
}

/**
 * Handler for CreateReleaseCandidateCommand.
 */
export class CreateReleaseCandidateHandler implements ICommandHandler<CreateReleaseCandidateCommand> {
    async handle(command: CreateReleaseCandidateCommand): Promise<any> {
        const { context, data } = command;
        const { releaseService } = await import('../../services/release.service');
        return await releaseService.create(data.projectId, data, context.actorId, context.role);
    }
}

/**
 * Handler for AddReleaseDecisionCommand.
 */
export class AddReleaseDecisionHandler implements ICommandHandler<AddReleaseDecisionCommand> {
    async handle(command: AddReleaseDecisionCommand): Promise<any> {
        const { releaseId, data, context } = command;
        const { releaseService } = await import('../../services/release.service');
        return await releaseService.addDecision(context.projectId || '', releaseId, data, context.actorId, context.role);
    }
}

/**
 * Handler for UpdateReleaseStatusCommand.
 */
export class UpdateReleaseStatusHandler implements ICommandHandler<UpdateReleaseStatusCommand> {
    async handle(command: UpdateReleaseStatusCommand): Promise<any> {
        const { id, nextStatus, context } = command;
        const { releaseService } = await import('../../services/release.service');
        return await releaseService.updateStatus(context.projectId || '', id, nextStatus, context.actorId, context.role);
    }
}

/**
 * Handler for CreateReleaseFollowUpCommand.
 */
export class CreateReleaseFollowUpHandler implements ICommandHandler<CreateReleaseFollowUpCommand> {
    async handle(command: CreateReleaseFollowUpCommand): Promise<any> {
        const { releaseId, data, context } = command;
        const { releaseService } = await import('../../services/release.service');
        return await releaseService.createFollowUp(context.projectId || '', releaseId, data, context.actorId, context.role);
    }
}

// Register
commandBus.registerHandler('CreateReleaseCandidate', new CreateReleaseCandidateHandler());
commandBus.registerHandler('AddReleaseDecision', new AddReleaseDecisionHandler());
commandBus.registerHandler('UpdateReleaseStatus', new UpdateReleaseStatusHandler());
commandBus.registerHandler('CreateReleaseFollowUp', new CreateReleaseFollowUpHandler());
