import { Request, Response, NextFunction } from 'express';
import { milestoneService } from '../services/milestone.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class MilestoneController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const milestone = await milestoneService.create(req.body, userId, role);
            sendResponse(res, 201, milestone, 'Milestone created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string | undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const sortBy = (req.query.sortBy as string) || 'dueDate';
            const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';
            const includeDeleted = req.query.includeDeleted === 'true';

            const result = await milestoneService.getAll(userId, role, projectId, page, limit, sortBy, sortOrder, includeDeleted);
            sendResponse(res, 200, result, 'Milestones retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const milestone = await milestoneService.getById(req.params.id, userId, role);
            sendResponse(res, 200, milestone, 'Milestone retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const milestone = await milestoneService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, milestone, 'Milestone updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const hardDelete = req.query.hardDelete === 'true';
            if (hardDelete) {
                await milestoneService.hardDelete(req.params.id, userId, role);
            } else {
                await milestoneService.delete(req.params.id, userId, role);
            }
            sendResponse(res, 204, null, hardDelete ? 'Milestone permanently deleted' : 'Milestone moved to trash');
        } catch (error) {
            next(error);
        }
    }

    async restore(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const milestone = await milestoneService.restore(req.params.id, userId, role);
            sendResponse(res, 200, milestone, 'Milestone restored successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const milestoneController = new MilestoneController();
