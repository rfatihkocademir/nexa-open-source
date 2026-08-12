import type { NextFunction, Request, Response } from 'express';
import { releaseConsensusService } from '../services/release-consensus.service';
import { sendResponse } from '../utils/apiResponse';
import { getAuthorizedProjectActor } from '../utils/requestContext';

export class ReleaseConsensusController {
    async getState(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = getAuthorizedProjectActor(req, req.params.projectId);
            sendResponse(res, 200, await releaseConsensusService.getState(actor.projectId, req.params.id, actor.userId, actor.role));
        } catch (error) { next(error); }
    }
    async updateTier(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = getAuthorizedProjectActor(req, req.params.projectId);
            sendResponse(res, 200, await releaseConsensusService.updateTier(actor.projectId, req.body.qualityTier, actor.userId, actor.role));
        } catch (error) { next(error); }
    }
    async startRound(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = getAuthorizedProjectActor(req, req.params.projectId);
            sendResponse(res, 201, await releaseConsensusService.startRound(actor.projectId, req.params.id, actor.userId, actor.role));
        } catch (error) { next(error); }
    }
    async decide(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = getAuthorizedProjectActor(req, req.params.projectId);
            sendResponse(res, 200, await releaseConsensusService.decide(actor.projectId, req.params.id, req.params.roundId, req.body.decision, req.body.rationale, actor.userId, actor.role));
        } catch (error) { next(error); }
    }
    async createPackage(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = getAuthorizedProjectActor(req, req.params.projectId);
            sendResponse(res, 201, await releaseConsensusService.createPackage(actor.projectId, req.params.id, actor.userId, actor.role));
        } catch (error) { next(error); }
    }
}

export const releaseConsensusController = new ReleaseConsensusController();
