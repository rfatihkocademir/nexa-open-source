import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { workItemService } from '../../services/workitem.service';
import { commandBus } from '../../core/bus/CommandBus';

/**
 * Command to update general attributes of a WorkItem (non-status).
 */
export class UpdateWorkItemCommand implements ICommand {
    readonly commandName = 'UpdateWorkItem';
    
    constructor(
        public readonly context: CommandContext,
        public readonly id: string,
        public readonly data: Record<string, any>
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
}

/**
 * Handler for UpdateWorkItemCommand.
 */
export class UpdateWorkItemHandler implements ICommandHandler<UpdateWorkItemCommand> {
    async handle(command: UpdateWorkItemCommand): Promise<any> {
        const { id, data, context } = command;
        return await workItemService.update(id, data, context.actorId);
    }
}

// Register
commandBus.registerHandler('UpdateWorkItem', new UpdateWorkItemHandler());
