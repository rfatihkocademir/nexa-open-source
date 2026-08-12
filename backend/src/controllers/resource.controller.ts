import { Request, Response, NextFunction } from 'express';
import { resourceService } from '../services/resource.service';
import { getRequestActor } from '../utils/requestContext';
import { sendResponse } from '../utils/apiResponse';

export class ResourceController {
    async resolveProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const project = await resourceService.resolveProject(req.params.key, userId, role);
            sendResponse(res, 200, project, 'Project resolved successfully');
        } catch (error) {
            next(error);
        }
    }

    async resolve(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const resource = await resourceService.resolve(req.params.key, userId, role);
            sendResponse(res, 200, resource, 'Resource resolved successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const resourceController = new ResourceController();
