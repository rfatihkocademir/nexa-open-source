
import { Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { getRequestActor } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';

export class CommentController {
    static async create(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const data = {
                content: req.body.content,
                workItemId: req.body.workItemId || req.body.storyId || req.body.taskId || req.body.bugId,
                authorId: userId,
                role,
            };
            const comment = await CommentService.create(data);
            res.status(201).json(comment);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async getByWorkItemId(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const workItemId = req.params.workItemId || req.params.storyId;
            const comments = await CommentService.getByWorkItemId(workItemId, userId, role);
            res.json(comments);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
