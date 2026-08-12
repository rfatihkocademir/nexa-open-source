import { Request, Response, NextFunction } from 'express';
import { tagService } from '../services/tag.service';
import { sendResponse } from '../utils/apiResponse';
import { getAuthorizedProjectId, getRequestActor } from '../utils/requestContext';

export const tagController = {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const tag = await tagService.create({
                ...req.body,
                projectId: getAuthorizedProjectId(req, req.body.projectId),
            }, userId, role);
            sendResponse(res, 201, tag, 'Tag created successfully');
        } catch (error) {
            next(error);
        }
    },

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const tag = await tagService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, tag, 'Tag updated successfully');
        } catch (error) {
            next(error);
        }
    },

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await tagService.delete(req.params.id, userId, role);
            sendResponse(res, 200, null, 'Tag deleted successfully');
        } catch (error) {
            next(error);
        }
    },

    async getByProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const tags = await tagService.getByProject(getAuthorizedProjectId(req, req.query.projectId), userId, role);
            sendResponse(res, 200, tags, 'Tags retrieved successfully');
        } catch (error) {
            next(error);
        }
    },
};
