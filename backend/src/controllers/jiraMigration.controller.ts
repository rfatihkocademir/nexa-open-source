import { Request, Response, NextFunction } from 'express';
import { jiraMigrationService } from '../services/jiraMigration.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';
import { AppError } from '../utils/AppError';

export class JiraMigrationController {
    async importFromJson(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const { projectId, issues } = req.body;

            if (!projectId) {
                throw new AppError('projectId is required', 400);
            }
            if (!Array.isArray(issues) || issues.length === 0) {
                throw new AppError('issues array is required and must not be empty', 400);
            }

            const result = await jiraMigrationService.parseAndImportIssues(projectId, userId, issues);
            sendResponse(res, 201, result, 'Jira migration completed successfully');
        } catch (error) {
            next(error);
        }
    }

    async importFromJiraApi(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const { projectId, hostUrl, email, apiToken, jiraProjectKey } = req.body;

            if (!projectId || !hostUrl || !email || !apiToken || !jiraProjectKey) {
                throw new AppError('projectId, hostUrl, email, apiToken, and jiraProjectKey are required', 400);
            }

            const result = await jiraMigrationService.fetchAndImportFromJiraApi(projectId, userId, {
                hostUrl,
                email,
                apiToken,
                jiraProjectKey,
            });

            sendResponse(res, 201, result, 'Jira API migration completed successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const jiraMigrationController = new JiraMigrationController();
