import { Request, Response } from 'express';
import { workflowSchemeService } from '../services/workflow-scheme.service';
import { getAuthorizedProjectActor, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';

export class WorkflowSchemeController {
    static async get(req: Request, res: Response) {
        try { res.json(await workflowSchemeService.get(getAuthorizedProjectId(req, req.query.projectId))); }
        catch (error) { respondWithControllerError(res, error); }
    }
    static async saveDraft(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workflowSchemeService.saveDraft(actor.projectId, req.body.config));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async validate(req: Request, res: Response) {
        try { res.json({ valid: true, config: workflowSchemeService.validate(req.body.config) }); }
        catch (error) { respondWithControllerError(res, error); }
    }
    static async refreshDraft(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workflowSchemeService.refreshDraftFromLive(actor.projectId));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async publish(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workflowSchemeService.publish(actor.projectId, actor.userId, req.body.changeNote));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async restore(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            res.json(await workflowSchemeService.restoreRevision(actor.projectId, req.params.revisionId));
        } catch (error) { respondWithControllerError(res, error); }
    }
}
