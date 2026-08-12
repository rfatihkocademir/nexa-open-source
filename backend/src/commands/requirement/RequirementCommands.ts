import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { commandBus } from '../../core/bus/CommandBus';
import { RequirementType, RequirementStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../utils/AppError';

/**
 * Command to create a new Requirement.
 */
export class CreateRequirementCommand implements ICommand {
    readonly commandName = 'CreateRequirement';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: {
            title: string;
            description?: string;
            type: RequirementType;
            projectId: string;
            sourceRequestId?: string;
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'Requirement',
            projectId: this.data.projectId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'create' };
    }
}

/**
 * Command to transition a Requirement's status.
 */
export class UpdateRequirementStatusCommand implements ICommand {
    readonly commandName = 'UpdateRequirementStatus';
    
    constructor(
        public readonly context: CommandContext,
        public readonly id: string,
        public readonly nextStatus: RequirementStatus,
        public readonly reason?: string
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'Requirement',
            resourceId: this.id,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }

    /**
     * Requirement-specific gates.
     */
    async checkGates(): Promise<void> {
        if (this.nextStatus === 'APPROVED') {
            // Rule: Approved requirement should ideally have linked test cases or at least structured content.
            // For now, let's just ensure it exists.
            const req = await prisma.requirement.findUnique({
                where: { id: this.id },
                include: { testCases: true }
            });
            
            if (!req) throw new AppError('Requirement not found', 404);
            
            // We could enforce that at least one test case exists before approval
            // if (req.testCases.length === 0) {
            //     throw new AppError('Approval blocked: Requirement must have at least one linked test case.', 409);
            // }
        }
    }
}

/**
 * Handler for CreateRequirementCommand.
 */
export class CreateRequirementHandler implements ICommandHandler<CreateRequirementCommand> {
    async handle(command: CreateRequirementCommand): Promise<any> {
        const { context, data } = command;
        const { requirementService } = await import('../../services/requirement.service');
        return await requirementService.create({
            ...data,
            authorId: context.actorId
        });
    }
}

/**
 * Handler for UpdateRequirementStatusCommand.
 */
export class UpdateRequirementStatusHandler implements ICommandHandler<UpdateRequirementStatusCommand> {
    async handle(command: UpdateRequirementStatusCommand): Promise<any> {
        const { id, nextStatus, reason, context } = command;
        const { requirementService } = await import('../../services/requirement.service');
        return await requirementService.updateStatus(id, nextStatus, context.actorId, reason);
    }
}

// Register
commandBus.registerHandler('CreateRequirement', new CreateRequirementHandler());
commandBus.registerHandler('UpdateRequirementStatus', new UpdateRequirementStatusHandler());
