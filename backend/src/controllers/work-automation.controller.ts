import { Request, Response } from 'express';
import { workAutomationService } from '../services/work-automation.service';
import { getAuthorizedProjectActor, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';

export class WorkAutomationController {
    static async list(req: Request, res: Response) {
        try { res.json(await workAutomationService.list(getAuthorizedProjectId(req, req.query.projectId))); }
        catch (error) { respondWithControllerError(res, error); }
    }
    static async executions(req: Request, res: Response) {
        try { res.json(await workAutomationService.executions(getAuthorizedProjectId(req, req.query.projectId), typeof req.query.ruleId === 'string' ? req.query.ruleId : undefined)); }
        catch (error) { respondWithControllerError(res, error); }
    }
    static async create(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.status(201).json(await workAutomationService.create(actor.projectId, actor.userId, req.body));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async update(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId || req.query.projectId);
            res.json(await workAutomationService.update(actor.projectId, req.params.id, actor.userId, req.body));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async dryRun(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workAutomationService.dryRun(actor.projectId, req.params.id, String(req.body.workItemId || ''), actor.userId));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async run(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workAutomationService.runManual(actor.projectId, req.params.id, String(req.body.workItemId || ''), actor.userId));
        } catch (error) { respondWithControllerError(res, error); }
    }
}
