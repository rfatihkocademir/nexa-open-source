import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { workItemService } from '../../services/workitem.service';
import { commandBus } from '../../core/bus/CommandBus';
import prisma from '../../utils/prisma';
import { assertWorkItemTransition } from '../../utils/stateMachine';
import { workflowGateService } from '../../services/workflowGate.service';
import { AppError } from '../../utils/AppError';
import { WorkItemType } from '@prisma/client';

/**
 * Command to change the status of a WorkItem.
 * This is the ONLY authoritative way to change status.
 */
export class UpdateWorkItemStatusCommand implements ICommand {
    readonly commandName = 'UpdateWorkItemStatus';
    
    constructor(
        public readonly context: CommandContext,
        public readonly id: string,
        public readonly nextStatus: string,
        public readonly reason?: string,
        public readonly metadata?: Record<string, any>
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'WorkItem',
            resourceId: this.id,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }

    /**
     * Mandate Gate Checks during dispatcher execution
     */
    async checkGates(): Promise<void> {
        const item = await prisma.workItem.findUnique({
            where: { id: this.id },
            select: { id: true, itemType: true, status: true, projectId: true, testResultId: true, foundInEnvId: true }
        });

        if (!item) throw new AppError('WorkItem not found', 404);

        // 1. Hard State Transition Validation
        assertWorkItemTransition(item.itemType, item.status, this.nextStatus);

        // 2. Specific Workflow Gates based on destination state
        if (item.itemType === WorkItemType.BUG) {
            await workflowGateService.assertBugTraceability({
                id: item.id,
                status: this.nextStatus,
                testResultId: this.metadata?.testResultId || item.testResultId,
                foundInEnvId: this.metadata?.foundInEnvId || item.foundInEnvId
            }, this.context.actorId, item.projectId);
        }

        if (this.nextStatus === 'IN_PROGRESS') {
            const workItem = await prisma.workItem.findUnique({
                where: { id: this.id },
                select: { id: true, itemType: true, requirementId: true, projectId: true }
            });
            
            if (workItem) {
                await workflowGateService.assertWorkItemHasApprovedRequirement(
                    workItem.id,
                    workItem.itemType,
                    workItem.requirementId,
                    this.context.actorId,
                    workItem.projectId
                );
            }
        }

        if (this.nextStatus === 'QA') {
            const testCasesCount = await prisma.testCase.count({ where: { workItemId: item.id, deletedAt: null } });
            const openPRCount = await prisma.pullRequest.count({ where: { workItemId: item.id, state: 'open' } });
            await workflowGateService.assertWorkItemReadyForQA({
                id: item.id,
                itemType: item.itemType
            }, testCasesCount, openPRCount, this.context.actorId, item.projectId);
        }
    }
}

/**
 * Handler for UpdateWorkItemStatusCommand.
 */
export class UpdateWorkItemStatusHandler implements ICommandHandler<UpdateWorkItemStatusCommand> {
    async handle(command: UpdateWorkItemStatusCommand): Promise<any> {
        const { id, nextStatus, reason, context } = command;
        
        // Final update via service (which handles audit/events)
        // Note: In a pure CQRS model, the handler would do the update directly.
        // For now, we reuse service logic but let the command/gate handle the authority.
        return await workItemService.update(id, { 
            status: nextStatus,
            statusChangeReason: reason 
        }, context.actorId);
    }
}

// Register
commandBus.registerHandler('UpdateWorkItemStatus', new UpdateWorkItemStatusHandler());
