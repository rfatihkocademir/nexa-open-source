import { Request, Response, NextFunction } from 'express';
import { testRunService } from '../services/testRun.service';
import { exportService } from '../services/export.service';
import { sendResponse } from '../utils/apiResponse';
import { runInBackground } from '../utils/backgroundTask';
import { getRequestActor } from '../utils/requestContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('TestRunController');

export class TestRunController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testRun = await testRunService.create(req.body, userId, role);
            sendResponse(res, 201, testRun, 'Test run created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            const isGlobal = req.query.global === 'true';
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const sortBy = (req.query.sortBy as string) || 'createdAt';
            const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

            const result = await testRunService.getAll(userId, role, projectId, isGlobal, page, limit, sortBy, sortOrder);
            sendResponse(res, 200, result, 'Test runs retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const itemPage = parseInt(req.query.itemPage as string) || 1;
            const itemLimit = parseInt(req.query.itemLimit as string) || 50;
            const testRun = await testRunService.getById(req.params.id, userId, role, itemPage, itemLimit);
            sendResponse(res, 200, testRun, 'Test run retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getConflicts(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const conflicts = await testRunService.getConflictItems(req.params.id, userId, role);
            sendResponse(res, 200, conflicts, 'Conflict items retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getComparisonReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const report = await testRunService.getComparisonReport(req.params.id, userId, role);
            sendResponse(res, 200, report, 'Comparison report retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
    async triggerAutomation(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            runInBackground(() => testRunService.triggerAutomation(req.params.id, userId, role), (err) => {
                logger.error(`Failed to trigger automation for run ${req.params.id}:`, err);
            });

            sendResponse(res, 200, { message: 'Automation execution started' }, 'Automation triggered successfully');
        } catch (error) {
            next(error);
        }
    }

    async triggerItemAutomation(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            runInBackground(() => testRunService.triggerItemAutomation(req.params.itemId, userId, role), (err) => {
                logger.error(`Failed to trigger automation for item ${req.params.itemId}:`, err);
            });

            sendResponse(res, 200, { message: 'Item automation execution started' }, 'Item automation triggered successfully');
        } catch (error) {
            next(error);
        }
    }

    async notifyCompletion(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const { id } = req.params;
            await testRunService.notifyCompletion(id, userId);
            sendResponse(res, 200, null, 'Completion notification sent');
        } catch (error) {
            next(error);
        }
    }

    async addItems(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { id } = req.params;
            const { testCaseIds } = req.body;

            if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
                return sendResponse(res, 400, null, 'testCaseIds array is required');
            }

            await testRunService.addItems(id, testCaseIds, userId, role);
            sendResponse(res, 200, null, 'Items added successfully');
        } catch (error) {
            next(error);
        }
    }

    async createQuickRun(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { testCaseId } = req.body;
            if (!testCaseId) {
                return sendResponse(res, 400, null, 'testCaseId is required');
            }

            const testRun = await testRunService.createQuickRun(testCaseId, userId, role);
            sendResponse(res, 201, testRun, 'Functional test created successfully');
        } catch (error) {
            next(error);
        }
    }
    async deleteItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await testRunService.deleteItem(req.params.itemId, userId, role);
            sendResponse(res, 200, null, 'Test run item deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const updatedRun = await testRunService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, updatedRun, 'Test run updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await testRunService.delete(req.params.id, userId, role);
            sendResponse(res, 200, null, 'Test run deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async getReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const report = await testRunService.getReport(req.params.id, userId, role);
            sendResponse(res, 200, report, 'Test run report retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async exportResults(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const buffer = await exportService.exportTestRunResults(req.params.id, userId, role);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=test-run-${req.params.id}-results.xlsx`);
            res.send(buffer);
        } catch (error) {
            next(error);
        }
    }

    async exportComparison(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const buffer = await exportService.exportComparisonReport(req.params.id, userId, role);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=test-run-${req.params.id}-comparison.pdf`);
            res.send(buffer);
        } catch (error) {
            next(error);
        }
    }
}

export const testRunController = new TestRunController();
