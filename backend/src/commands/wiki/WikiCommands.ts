import { ICommand, ICommandHandler, CommandContext } from '../../core/bus/types';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';
import { wikiService } from '../../services/wiki.service';
import { commandBus } from '../../core/bus/CommandBus';
import { ArtifactStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';

export class UpdateWikiPageStatusCommand implements ICommand {
    readonly commandName = 'UpdateWikiPageStatus';

    constructor(
        public readonly context: CommandContext,
        public readonly pageId: string,
        public readonly status: ArtifactStatus
    ) {}

    getPolicyResource(): PolicyResource {
        return {
            resourceType: 'WikiPage',
            resourceId: this.pageId,
        };
    }

    getPolicyAction(): PolicyAction {
        return { action: 'update' };
    }

    async checkGates(): Promise<void> {
        // Enforce that only authorized roles can APPROVE
        if (this.status === 'APPROVED' && !['ADMIN', 'TEAM_LEADER'].includes(this.context.role)) {
            throw new AppError('Only Admins or Team Leaders can approve wiki pages.', 403);
        }
    }
}

export class UpdateWikiPageStatusHandler implements ICommandHandler<UpdateWikiPageStatusCommand> {
    async handle(command: UpdateWikiPageStatusCommand): Promise<any> {
        return await wikiService.updateStatus(
            command.pageId,
            command.context.actorId,
            command.status
        );
    }
}

// Register handler
commandBus.registerHandler('UpdateWikiPageStatus', new UpdateWikiPageStatusHandler());
