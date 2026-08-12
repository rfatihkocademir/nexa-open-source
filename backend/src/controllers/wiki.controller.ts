import { Request, Response } from 'express';
import { wikiService } from '../services/wiki.service';
import { commandBus } from '../core/bus/CommandBus';
import { UpdateWikiPageStatusCommand } from '../commands/wiki/WikiCommands';
import { AppError } from '../utils/AppError';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectId, getRequestActor, getAuditContext } from '../utils/requestContext';

export class WikiController {
    async getSpaces(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.projectId);
            const includeDeleted = req.query.includeDeleted === 'true';
            const spaces = await wikiService.getSpaces(projectId, includeDeleted);
            res.json(spaces);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch spaces');
        }
    }

    async createSpace(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.params.projectId);
            const space = await wikiService.createSpace(projectId, req.body);
            res.json(space);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to create space');
        }
    }

    async getPageTree(req: Request, res: Response) {
        try {
            const { spaceId } = req.params;
            const includeDeleted = req.query.includeDeleted === 'true';
            const tree = await wikiService.getPageTree(spaceId, includeDeleted);
            res.json(tree);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch page tree');
        }
    }

    async getPage(req: Request, res: Response) {
        try {
            const { pageId } = req.params;
            const page = await wikiService.getPage(pageId);
            if (!page) throw new AppError('Page not found', 404);
            res.json(page);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch page');
        }
    }

    async createPage(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const page = await wikiService.createPage(userId, req.body);
            res.json(page);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to create page');
        }
    }

    async updatePage(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const { pageId } = req.params;
            const page = await wikiService.updatePage(pageId, userId, req.body);
            res.json(page);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to update page');
        }
    }

    async updateStatus(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const { pageId } = req.params;
            const { status } = req.body;

            // 1. Get detailed audit context
            const auditContext = getAuditContext(req);
            
            // 2. Build full authoritative CommandContext
            const context = {
                ...auditContext,
                role
            };

            const result = await commandBus.dispatch(new UpdateWikiPageStatusCommand(
                context,
                pageId,
                status
            ));

            res.json(result);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to update page status');
        }
    }

    async restoreSpace(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const { spaceId } = req.params;
            const space = await wikiService.restoreSpace(spaceId, userId);
            res.json(space);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to restore space');
        }
    }

    async restorePage(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const { pageId } = req.params;
            const page = await wikiService.restorePage(pageId, userId);
            res.json(page);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to restore page');
        }
    }

    async deletePage(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const { pageId } = req.params;
            const page = await wikiService.deletePage(pageId, userId);
            res.json(page);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to delete page');
        }
    }

    async deleteSpace(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const { spaceId } = req.params;
            const space = await wikiService.deleteSpace(spaceId, userId);
            res.json(space);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to delete space');
        }
    }
}
