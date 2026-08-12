import { Request, Response, NextFunction } from 'express';
import { testSuiteService } from '../services/testSuite.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class TestSuiteController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const suite = await testSuiteService.create(req.body, userId, role);
            sendResponse(res, 201, suite, 'Test suite created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            if (!projectId) {
                return sendResponse(res, 400, null, 'Project ID is required');
            }
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const includeDeleted = req.query.includeDeleted === 'true';
            const suites = await testSuiteService.getAll(userId, role, projectId, page, limit, includeDeleted);
            sendResponse(res, 200, suites, 'Test suites retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const suite = await testSuiteService.getById(req.params.id, userId, role);
            sendResponse(res, 200, suite, 'Test suite retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const suite = await testSuiteService.update(req.params.id, req.body, userId, role);
            sendResponse(res, 200, suite, 'Test suite updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const result = await testSuiteService.delete(req.params.id, userId, role);
            sendResponse(res, 200, result, 'Test suite soft deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async restore(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const result = await testSuiteService.restore(req.params.id, userId, role);
            sendResponse(res, 200, result, 'Test suite restored successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const testSuiteController = new TestSuiteController();
