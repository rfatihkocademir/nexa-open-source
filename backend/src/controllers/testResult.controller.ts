import { Request, Response, NextFunction } from 'express';
import { testResultService } from '../services/testResult.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class TestResultController {
    async addResult(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const result = await testResultService.addResult(
                req.params.runItemId,
                req.body,
                userId,
                role
            );
            sendResponse(res, 201, result, 'Test result added successfully');
        } catch (error) {
            next(error);
        }
    }

    async addManualResult(req: Request, res: Response, next: NextFunction) {
        // Alias for addResult, but maybe specific validation later
        return this.addResult(req, res, next);
    }

    async addAutomationResult(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { status, duration, errorOutput, videoUrl } = req.body;
            const result = await testResultService.addAutomationResult(
                req.params.runItemId,
                status,
                userId,
                role,
                duration,
                errorOutput,
                videoUrl
            );
            sendResponse(res, 200, result, 'Automation result updated successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const testResultController = new TestResultController();
