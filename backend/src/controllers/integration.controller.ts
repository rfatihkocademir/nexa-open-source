import { Request, Response, NextFunction } from 'express';
import { integrationService } from '../services/integration.service';
import { getAuthorizedProjectActor } from '../utils/requestContext';

export class IntegrationController {

    async getIntegrations(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const integrations = await integrationService.getIntegrations(projectId, userId, role);
            res.json(integrations);
        } catch (error) {
            next(error);
        }
    }

    async createIntegration(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const integration = await integrationService.createIntegration(projectId, req.body, userId, role);
            res.status(201).json(integration);
        } catch (error) {
            next(error);
        }
    }

    async updateIntegration(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const { id } = req.params;
            const integration = await integrationService.updateIntegration(id, projectId, req.body, userId, role);
            res.json(integration);
        } catch (error) {
            next(error);
        }
    }

    async deleteIntegration(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const { id } = req.params;
            await integrationService.deleteIntegration(id, projectId, userId, role);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

export const integrationController = new IntegrationController();
