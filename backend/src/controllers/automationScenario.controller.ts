import { Request, Response, NextFunction } from 'express';
import { automationScenarioService } from '../services/automationScenario.service';
import { sendResponse } from '../utils/apiResponse';
import { getAuthorizedProjectActor, getRequestActor } from '../utils/requestContext';

export const automationScenarioController = {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const scenario = await automationScenarioService.create(req.body, userId, role);
            sendResponse(res, 201, scenario, 'Automation scenario created successfully');
        } catch (error) {
            next(error);
        }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const scenario = await automationScenarioService.findById(req.params.id, userId, role);
            sendResponse(res, 200, scenario, 'Automation scenario retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    async getByTestCaseId(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const scenario = await automationScenarioService.findByTestCaseId(req.params.testCaseId, userId, role);
            sendResponse(res, 200, scenario, 'Automation scenario retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const scenario = await automationScenarioService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, scenario, 'Automation scenario updated successfully');
        } catch (error) {
            next(error);
        }
    },

    async publish(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const scenario = await automationScenarioService.publish(req.params.id, userId, role);
            sendResponse(res, 200, scenario, 'Automation scenario published successfully');
        } catch (error) {
            next(error);
        }
    },

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await automationScenarioService.delete(req.params.id, userId, role);
            sendResponse(res, 200, null, 'Automation scenario deleted successfully');
        } catch (error) {
            next(error);
        }
    },

    async startDryRun(req: Request, res: Response, next: NextFunction) {
        try {
            const { steps, variables, headless } = req.body as {
                steps: any[];
                variables: Record<string, string>;
                headless?: boolean;
            };
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const result = await automationScenarioService.startDryRun(steps, variables || {}, headless, actor);
            sendResponse(res, 202, result, 'Dry-run started');
        } catch (error) {
            next(error);
        }
    },

    async dryRun(req: Request, res: Response, next: NextFunction) {
        try {
            const { steps, variables, headless } = req.body as {
                steps: any[];
                variables: Record<string, string>;
                headless?: boolean;
            };
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const result = await automationScenarioService.dryRun(steps, variables || {}, headless, undefined, actor);
            sendResponse(res, 200, result, 'Dry-run completed');
        } catch (error) {
            next(error);
        }
    },

    async getDryRunStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { dryRunId } = req.params;
            const baseActor = getRequestActor(req);
            const result = await automationScenarioService.getDryRunStatus(dryRunId, baseActor);
            sendResponse(res, 200, result, 'Dry-run status retrieved');
        } catch (error) {
            next(error);
        }
    },

    async getLiveFrame(req: Request, res: Response, next: NextFunction) {
        try {
            const frame = await automationScenarioService.getLiveFrame(req.params.dryRunId, getRequestActor(req));
            if (!frame) {
                res.status(204).end();
                return;
            }
            sendResponse(res, 200, frame, 'Live frame retrieved');
        } catch (error) {
            next(error);
        }
    },

    async clearDryRun(req: Request, res: Response, next: NextFunction) {
        try {
            const { dryRunId } = req.params;
            const result = await automationScenarioService.clearDryRun(dryRunId, getRequestActor(req));
            sendResponse(res, 200, result, 'Dry-run cleared');
        } catch (error) {
            next(error);
        }
    },

    async cleanupVideo(req: Request, res: Response, next: NextFunction) {
        try {
            const { videoUrl } = req.body as { videoUrl?: string };
            if (!videoUrl) {
                sendResponse(res, 400, null, 'videoUrl is required');
                return;
            }

            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            await automationScenarioService.cleanupVideo(videoUrl, actor);
            sendResponse(res, 200, null, 'Video cleaned up successfully');
        } catch (error) {
            next(error);
        }
    },
};
