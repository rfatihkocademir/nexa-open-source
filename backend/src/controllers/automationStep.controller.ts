import { Request, Response, NextFunction } from 'express';
import { automationStepService } from '../services/automationStep.service';
import { sendResponse } from '../utils/apiResponse';
import { stepSuggestionService } from '../services/stepSuggestion.service';
import { getRequestActor } from '../utils/requestContext';

export const automationStepController = {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const step = await automationStepService.create(req.body, userId, role);
            sendResponse(res, 201, step, 'Automation step created successfully');
        } catch (error) {
            next(error);
        }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const step = await automationStepService.findById(req.params.id, userId, role);
            sendResponse(res, 200, step, 'Automation step retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    async getByProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            const steps = await automationStepService.findByProject(projectId, userId, role);
            sendResponse(res, 200, steps, 'Automation steps retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const step = await automationStepService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, step, 'Automation step updated successfully');
        } catch (error) {
            next(error);
        }
    },

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await automationStepService.delete(req.params.id, userId, role);
            sendResponse(res, 200, null, 'Automation step deleted successfully');
        } catch (error) {
            next(error);
        }
    },

    async suggest(req: Request, res: Response, next: NextFunction) {
        try {
            const { html } = req.body as { html?: string };
            if (!html) {
                sendResponse(res, 400, null, 'HTML content is required');
                return;
            }

            const suggestions = await stepSuggestionService.suggest(html);
            sendResponse(res, 200, suggestions, 'Step suggestions generated successfully');
        } catch (error) {
            next(error);
        }
    },
};
