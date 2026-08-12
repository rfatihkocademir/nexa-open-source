import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { environmentService } from '../../services/environment.service';
import { commandBus } from '../../core/bus/CommandBus';
import { EnvironmentType } from '@prisma/client';

/**
 * Command to create a new Environment.
 */
export class CreateEnvironmentCommand implements ICommand {
    readonly commandName = 'CreateEnvironment';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: {
            projectId: string;
            name: string;
            description?: string;
            type?: EnvironmentType;
            orderIndex?: number;
            isProduction?: boolean;
            requiresApproval?: boolean;
            deploymentPolicy?: string;
            rollbackPolicy?: string;
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'Environment',
            projectId: this.data.projectId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'create' };
    }
}

/**
 * Command to update an existing Environment.
 */
export class UpdateEnvironmentCommand implements ICommand {
    readonly commandName = 'UpdateEnvironment';
    
    constructor(
        public readonly context: CommandContext,
        public readonly id: string,
        public readonly data: Record<string, any>
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'Environment',
            resourceId: this.id,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }
}

/**
 * Handler for Environment Commands.
 */
export class EnvironmentCommandHandler implements ICommandHandler<ICommand> {
    async handle(command: ICommand): Promise<any> {
        if (command instanceof CreateEnvironmentCommand) {
            return await environmentService.create(command.data.projectId, command.data, command.context.actorId, command.context.role);
        }
        if (command instanceof UpdateEnvironmentCommand) {
            return await environmentService.update(command.id, command.data, command.context.actorId, command.context.role);
        }
    }
}

// Register
const handler = new EnvironmentCommandHandler();
commandBus.registerHandler('CreateEnvironment', handler);
commandBus.registerHandler('UpdateEnvironment', handler);
