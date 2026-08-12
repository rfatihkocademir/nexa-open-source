import { Request, Response } from 'express';
import { workItemService } from '../services/workitem.service';
import { AppError } from '../utils/AppError';
import { WorkItemType } from '@prisma/client';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectId, getRequestActor } from '../utils/requestContext';
import { commandBus } from '../core/bus/CommandBus';
import { CreateWorkItemCommand, UpdateWorkItemStatusCommand, UpdateWorkItemCommand } from '../commands/workitem';

const parseWorkItemType = (value: unknown, fieldName: string) => {
    if (!value || typeof value !== 'string') {
        throw new AppError(`${fieldName} is required`, 400);
    }

    const normalizedItemType = value.toUpperCase();
    if (!Object.values(WorkItemType).includes(normalizedItemType as WorkItemType)) {
        throw new AppError(`Invalid itemType: ${value}`, 400);
    }

    return normalizedItemType as WorkItemType;
};

export class WorkItemController {
    static async search(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            res.json(await workItemService.search(
                projectId,
                String(req.query.q || ''),
                userId,
                Number(req.query.page || 1),
                Number(req.query.pageSize || 50),
            ));
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { userId } = getRequestActor(req);
            const data: Record<string, unknown> = { ...req.body };
            const routeItemType = (res.locals.itemType || req.query.itemType) as string;

            if (routeItemType) {
                data.itemType = routeItemType.toUpperCase();
            }

            data.projectId = getAuthorizedProjectId(req, typeof data.projectId === 'string' ? data.projectId : undefined);
            data.itemType = parseWorkItemType(data.itemType, 'itemType');
            data.reporterId = userId;

            const item = await commandBus.dispatch(new CreateWorkItemCommand(
                { actorId: userId, role: req.user!.role, projectId: data.projectId as string },
                data
            ));
            res.status(201).json(item);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async getAll(req: Request, res: Response) {
        try {
            const itemType = res.locals.itemType || req.query.itemType;
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            const includeDeleted = req.query.includeDeleted === 'true';

            let typeParam: WorkItemType | undefined;
            if (itemType) {
                typeParam = parseWorkItemType(itemType, 'itemType');
            }

            const items = await workItemService.findAll(projectId, typeParam, includeDeleted);
            res.json(items);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async getById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const item = await workItemService.findById(id);
            if (!item) throw new AppError('WorkItem not found', 404);
            res.json(item);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { userId, role } = getRequestActor(req);
            const body = req.body as Record<string, any>;

            // If status is being changed, we MUST use the authoritative command
            if (body.status) {
                const item = await commandBus.dispatch(new UpdateWorkItemStatusCommand(
                    { actorId: userId, role, projectId: body.projectId },
                    id,
                    body.status,
                    body.statusChangeReason,
                    body
                ));
                return res.json(item);
            }

            // For non-status updates, use the authoritative command to ensure Policy and Audit
            let projectId = body.projectId;
            if (!projectId) {
                const existing = await workItemService.findById(id);
                projectId = existing?.projectId;
            }

            const item = await commandBus.dispatch(new UpdateWorkItemCommand(
                { actorId: userId, role, projectId },
                id,
                body
            ));
            res.json(item);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { userId } = getRequestActor(req);
            const hardDelete = req.query.hardDelete === 'true';
            if (hardDelete) {
                await workItemService.hardDelete(id, userId);
            } else {
                await workItemService.delete(id, userId);
            }
            res.status(204).send();
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    static async restore(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { userId } = getRequestActor(req);
            const item = await workItemService.restore(id, userId);
            res.json(item);
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}
