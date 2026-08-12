import { NextFunction, Request, Response } from 'express';
import { releaseService } from '../services/release.service';
import { releaseEligibilityService } from '../services/releaseEligibility.service';
import { sendResponse } from '../utils/apiResponse';
import { getAuthorizedProjectActor } from '../utils/requestContext';
import { commandBus } from '../core/bus/CommandBus';
import { CreateReleaseCandidateCommand, AddReleaseDecisionCommand, UpdateReleaseStatusCommand, CreateReleaseFollowUpCommand } from '../commands/release/ReleaseCommands';
import { respondWithControllerError } from '../utils/controllerError';

export class ReleaseController {
    async listByProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const releases = await releaseService.listByProject(projectId, userId, role);
            sendResponse(res, 200, releases, 'Release candidates retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const release = await releaseService.getById(projectId, req.params.id, userId, role);
            sendResponse(res, 200, release, 'Release candidate retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            
            const release = await commandBus.dispatch(new CreateReleaseCandidateCommand(
                { actorId: userId, role, projectId },
                { ...req.body, projectId }
            ));

            sendResponse(res, 201, release, 'Release candidate created successfully');
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    async addDecision(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            
            // Note: The PolicyInterceptor will handle resource-level authorization
            const release = await commandBus.dispatch(new AddReleaseDecisionCommand(
                { actorId: userId, role, projectId },
                req.params.id,
                req.body
            ));

            sendResponse(res, 200, release, 'Decision recorded successfully');
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }

    async createFollowUp(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            
            const followUp = await commandBus.dispatch(new CreateReleaseFollowUpCommand(
                { actorId: userId, role, projectId },
                req.params.id,
                req.body
            ));

            sendResponse(res, 201, followUp, 'Release follow-up created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAISummary(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const summary = await releaseService.getAISummary(projectId, req.params.id, userId, role);
            sendResponse(res, 200, summary, 'AI release summary retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getEligibilityReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const report = await releaseEligibilityService.evaluate(req.params.id, projectId);
            sendResponse(res, 200, report, 'Eligibility report retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            
            const release = await commandBus.dispatch(new UpdateReleaseStatusCommand(
                { actorId: userId, role, projectId },
                req.params.id,
                req.body.status
            ));

            sendResponse(res, 200, release, 'Release status updated successfully');
        } catch (error) {
            respondWithControllerError(res, error);
        }
    }
}

export const releaseController = new ReleaseController();
