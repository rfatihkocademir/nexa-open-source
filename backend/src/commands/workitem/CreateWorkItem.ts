import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { workItemService } from '../../services/workitem.service';
import { commandBus } from '../../core/bus/CommandBus';

/**
 * Command to create a new WorkItem.
 */
export class CreateWorkItemCommand implements ICommand {
    readonly commandName = 'CreateWorkItem';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: Record<string, any>
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'WorkItem',
            projectId: this.context.projectId || this.data.projectId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'create' };
    }
}

/**
 * Handler for CreateWorkItemCommand.
 * 1. Normalizes data
 * 2. Enforces creation-specific domain rules
 * 3. Persists to DB
 */
export class CreateWorkItemHandler implements ICommandHandler<CreateWorkItemCommand> {
    async handle(command: CreateWorkItemCommand): Promise<any> {
        const { context, data } = command;
        
        // Use existing service for the heavy lifting of normalization/logic for now,
        // but we can gradually move individual validations here or into specific Gates.
        return await workItemService.create(data, context.actorId);
    }
}

// Register the handler
commandBus.registerHandler('CreateWorkItem', new CreateWorkItemHandler());
