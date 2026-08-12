import { Request, Response } from 'express';
import { savedViewService } from '../services/saved-view.service';
import { getAuthorizedProjectActor, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';

export class SavedViewController {
    static async list(req: Request, res: Response) {
        try {
            const { userId } = getAuthorizedProjectActor(req, req.query.projectId);
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            const views = await savedViewService.list(projectId, userId, String(req.query.viewType || ''));
            res.json(views);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const view = await savedViewService.create(req.body, actor);
            res.status(201).json(view);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.query.projectId);
            await savedViewService.delete(req.params.id, actor);
            res.status(204).send();
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
