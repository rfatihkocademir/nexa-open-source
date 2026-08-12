import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { commandBus } from '../../core/bus/CommandBus';
import prisma from '../../utils/prisma';
import { AppError } from '../../utils/AppError';

/**
 * Command to create a new Automation Scenario.
 */
export class CreateAutomationScenarioCommand implements ICommand {
    readonly commandName = 'CreateAutomationScenario';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: {
            testCaseId: string;
            projectId: string;
            title: string;
            description?: string;
            variables?: any;
            requirementId?: string;
            steps: { stepId: string; orderIndex: number; parameters?: any }[];
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'AutomationScenario',
            projectId: this.data.projectId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'create' };
    }
}

/**
 * Command to publish an Automation Scenario.
 */
export class PublishAutomationScenarioCommand implements ICommand {
    readonly commandName = 'PublishAutomationScenario';
    
    constructor(
        public readonly context: CommandContext,
        public readonly scenarioId: string
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'AutomationScenario',
            resourceId: this.scenarioId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' }; // publishing is a state change
    }

    async checkGates(): Promise<void> {
        const scenario = await prisma.automationScenario.findUnique({
            where: { id: this.scenarioId },
            include: { steps: true }
        });

        if (!scenario) throw new AppError('Scenario not found', 404);
        if (scenario.steps.length === 0) {
            throw new AppError('Cannot publish an empty automation scenario. Add at least one step.', 400);
        }
    }
}

/**
 * Handler for CreateAutomationScenarioCommand.
 */
export class CreateAutomationScenarioHandler implements ICommandHandler<CreateAutomationScenarioCommand> {
    async handle(command: CreateAutomationScenarioCommand): Promise<any> {
        const { data } = command;
        
        return await prisma.automationScenario.create({
            data: {
                projectId: data.projectId,
                testCaseId: data.testCaseId,
                requirementId: data.requirementId || null,
                title: data.title,
                description: data.description || null,
                variables: data.variables || {},
                status: 'DRAFT',
                steps: {
                    create: data.steps.map(s => ({
                        testStepId: s.stepId,
                        orderIndex: s.orderIndex,
                        parameters: s.parameters || {}
                    }))
                }
            },
            include: { steps: true }
        });
    }
}

/**
 * Handler for PublishAutomationScenarioCommand.
 */
export class PublishAutomationScenarioHandler implements ICommandHandler<PublishAutomationScenarioCommand> {
    async handle(command: PublishAutomationScenarioCommand): Promise<any> {
        const { scenarioId } = command;
        const current = await prisma.automationScenario.findUnique({
            where: { id: scenarioId },
            select: { status: true },
        });
        
        return await prisma.automationScenario.update({
            where: { id: scenarioId },
            data: { 
                status: 'PUBLISHED',
                version: current?.status === 'PUBLISHED' ? { increment: 1 } : undefined,
                updatedAt: new Date()
            }
        });
    }
}

// Register Handlers
commandBus.registerHandler('CreateAutomationScenario', new CreateAutomationScenarioHandler());
commandBus.registerHandler('PublishAutomationScenario', new PublishAutomationScenarioHandler());
