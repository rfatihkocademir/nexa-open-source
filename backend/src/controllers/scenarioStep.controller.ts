import { Request, Response, NextFunction } from 'express';
import { scenarioStepService } from '../services/scenarioStep.service';
import { sendResponse } from '../utils/apiResponse';

export const scenarioStepController = {
    async addStep(req: Request, res: Response, next: NextFunction) {
        try {
            const scenarioStep = await scenarioStepService.addStep(req.body, req.user!.id, req.user!.role);
            sendResponse(res, 201, scenarioStep, 'Scenario step added successfully');
        } catch (error) {
            next(error);
        }
    },

    async getSteps(req: Request, res: Response, next: NextFunction) {
        try {
            const steps = await scenarioStepService.getScenarioSteps(req.params.scenarioId, req.user!.id, req.user!.role);
            sendResponse(res, 200, steps, 'Scenario steps retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    async removeStep(req: Request, res: Response, next: NextFunction) {
        try {
            await scenarioStepService.removeStep(req.params.id, req.user!.id, req.user!.role);
            sendResponse(res, 200, null, 'Scenario step removed successfully');
        } catch (error) {
            next(error);
        }
    },

    async reorderSteps(req: Request, res: Response, next: NextFunction) {
        try {
            const steps = await scenarioStepService.reorderSteps(req.body, req.user!.id, req.user!.role);
            sendResponse(res, 200, steps, 'Scenario steps reordered successfully');
        } catch (error) {
            next(error);
        }
    },
};
