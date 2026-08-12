import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { commandBus } from '../../core/bus/CommandBus';
import prisma from '../../utils/prisma';
import { AppError } from '../../utils/AppError';

/**
 * Command to create/update a Prompt Template (Slug and Metadata).
 */
export class UpsertPromptTemplateCommand implements ICommand {
    readonly commandName = 'UpsertPromptTemplate';
    
    constructor(
        public readonly context: CommandContext,
        public readonly data: {
            slug: string;
            name: string;
            description?: string;
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return { resourceType: 'PromptTemplate' };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'write' };
    }
}

/**
 * Command to create a new Prompt Version.
 */
export class CreatePromptVersionCommand implements ICommand {
    readonly commandName = 'CreatePromptVersion';
    
    constructor(
        public readonly context: CommandContext,
        public readonly slug: string,
        public readonly data: {
            templateBody: string;
            inputSchema?: any;
            outputSchema?: any;
            config?: any;
        }
    ) {}

    getPolicyResource(): PolicyResource {
        return { resourceType: 'PromptTemplate', resourceId: this.slug };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }
}

/**
 * Command to set the current (active) version of a prompt.
 */
export class SetCurrentPromptVersionCommand implements ICommand {
    readonly commandName = 'SetCurrentPromptVersion';
    
    constructor(
        public readonly context: CommandContext,
        public readonly slug: string,
        public readonly version: number
    ) {}

    getPolicyResource(): PolicyResource {
        return { resourceType: 'PromptTemplate', resourceId: this.slug };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }
}

/**
 * Handler for UpsertPromptTemplateCommand.
 */
export class UpsertPromptTemplateHandler implements ICommandHandler<UpsertPromptTemplateCommand> {
    async handle(command: UpsertPromptTemplateCommand): Promise<any> {
        const { data } = command;
        return await prisma.promptTemplate.upsert({
            where: { slug: data.slug },
            create: {
                slug: data.slug,
                name: data.name,
                description: data.description || null
            },
            update: {
                name: data.name,
                description: data.description || null
            }
        });
    }
}

/**
 * Handler for CreatePromptVersionCommand.
 */
export class CreatePromptVersionHandler implements ICommandHandler<CreatePromptVersionCommand> {
    async handle(command: CreatePromptVersionCommand): Promise<any> {
        const { slug, data, context } = command;
        
        const template = await prisma.promptTemplate.findUnique({
            where: { slug },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });

        if (!template) throw new AppError(`Prompt template "${slug}" not found`, 404);

        const nextVersion = template.versions.length > 0 ? template.versions[0].version + 1 : 1;

        return await prisma.promptVersion.create({
            data: {
                templateId: template.id,
                version: nextVersion,
                templateBody: data.templateBody,
                inputSchema: data.inputSchema || null,
                outputSchema: data.outputSchema || null,
                config: data.config || null,
                createdById: context.actorId
            }
        });
    }
}

/**
 * Handler for SetCurrentPromptVersionCommand.
 */
export class UpdatePromptVersionHandler implements ICommandHandler<SetCurrentPromptVersionCommand> {
    async handle(command: SetCurrentPromptVersionCommand): Promise<any> {
        const { slug, version } = command;
        
        return await prisma.promptTemplate.update({
            where: { slug },
            data: { currentVersion: version }
        });
    }
}

// Register Handlers
commandBus.registerHandler('UpsertPromptTemplate', new UpsertPromptTemplateHandler());
commandBus.registerHandler('CreatePromptVersion', new CreatePromptVersionHandler());
commandBus.registerHandler('SetCurrentPromptVersion', new UpdatePromptVersionHandler());
