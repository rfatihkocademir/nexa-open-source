import { Request, Response } from 'express';
import { BoardColumnService } from '../services/board-column.service';
import { AppError } from '../utils/AppError';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectId } from '../utils/requestContext';
import { getRequestActor } from '../utils/requestContext';

export class BoardColumnController {
    static async applyTemplate(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            const mode = req.body.mode === 'APPEND' ? 'APPEND' : 'REPLACE';
            const columns = await BoardColumnService.applyTemplate(
                projectId,
                userId,
                role,
                mode,
                req.body.columns,
            );
            res.status(200).json(columns);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const { name, mappedStatus, color, wipLimit, allowedTransitions } = req.body;
            if (!name) {
                throw new AppError('name is required.', 400);
            }
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            const column = await BoardColumnService.create(projectId, name, userId, role, {
                mappedStatus,
                color,
                wipLimit: wipLimit != null ? Number(wipLimit) : undefined,
                allowedTransitions: Array.isArray(allowedTransitions) ? allowedTransitions : [],
            });
            res.status(201).json(column);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async getByProjectId(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = getAuthorizedProjectId(req, req.params.projectId);
            const columns = await BoardColumnService.getByProjectId(projectId, userId, role);
            res.json(columns);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const { name, mappedStatus, color, wipLimit, allowedTransitions } = req.body;
            const column = await BoardColumnService.update(req.params.id, userId, role, {
                name,
                mappedStatus,
                color,
                wipLimit: wipLimit !== undefined ? (wipLimit === null ? null : Number(wipLimit)) : undefined,
                allowedTransitions: Array.isArray(allowedTransitions) ? allowedTransitions : undefined,
            });
            res.json(column);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            await BoardColumnService.delete(req.params.id, userId, role);
            res.status(204).send();
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async reorder(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            const { columns } = req.body;
            const result = await BoardColumnService.reorder(columns, userId, role);
            res.json(result);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
