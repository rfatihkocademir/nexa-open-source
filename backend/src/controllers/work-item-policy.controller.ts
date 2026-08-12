import { Request, Response } from 'express';
import { getRequestActor } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';
import { WorkItemPolicyService } from '../services/work-item-policy.service';

export class WorkItemPolicyController {
    static async list(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            res.json(await WorkItemPolicyService.list(req.params.projectId, userId, role));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async upsert(req: Request, res: Response) {
        try {
            const { userId, role } = getRequestActor(req);
            res.json(await WorkItemPolicyService.upsert(req.params.projectId, req.params.itemType, userId, role, req.body));
        } catch (error) { respondWithControllerError(res, error); }
    }
}
