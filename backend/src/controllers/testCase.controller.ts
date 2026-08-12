import { Request, Response, NextFunction } from 'express';
import { testCaseService } from '../services/testCase.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class TestCaseController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testCase = await testCaseService.create(req.body, userId, role);
            sendResponse(res, 201, testCase, 'Test case created successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const suiteId = req.query.suiteId as string | undefined;
            const includeDeleted = req.query.includeDeleted === 'true';
            const testCases = await testCaseService.getAll(userId, role, suiteId, includeDeleted);
            sendResponse(res, 200, testCases, 'Test cases retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAllByProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string | undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const search = req.query.search as string | undefined;

            const result = await testCaseService.getAllByProject(userId, role, projectId, page, limit, search);
            sendResponse(res, 200, result, 'Test cases retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testCase = await testCaseService.getById(req.params.id, userId, role);
            sendResponse(res, 200, testCase, 'Test case retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getByKey(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testCase = await testCaseService.getByKey(req.params.key, userId, role);
            sendResponse(res, 200, testCase, 'Test case retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testCase = await testCaseService.update(
                req.params.id,
                req.body,
                userId,
                role
            );
            sendResponse(res, 200, testCase, 'Test case updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const hardDelete = req.query.hardDelete === 'true';
            await testCaseService.delete(req.params.id, userId, role, hardDelete);
            sendResponse(res, 200, null, hardDelete ? 'Test case permanently deleted' : 'Test case moved to trash');
        } catch (error) {
            next(error);
        }
    }

    async restore(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await testCaseService.restore(req.params.id, userId, role);
            sendResponse(res, 200, null, 'Test case restored successfully');
        } catch (error) {
            next(error);
        }
    }

    async approve(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const testCase = await testCaseService.approve(req.params.id, userId, role);
            sendResponse(res, 200, testCase, 'Test case approved successfully');
        } catch (error) {
            next(error);
        }
    }

    async requestRevision(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { comment } = req.body;
            const testCase = await testCaseService.requestRevision(req.params.id, userId, role, comment);
            sendResponse(res, 200, testCase, 'Revision requested successfully');
        } catch (error) {
            next(error);
        }
    }
    async revert(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const version = parseInt(req.params.version);
            if (isNaN(version)) {
                return sendResponse(res, 400, null, 'Invalid version number');
            }
            const testCase = await testCaseService.revertToVersion(req.params.id, version, userId, role);
            sendResponse(res, 200, testCase, 'Test case reverted successfully');
        } catch (error) {
            next(error);
        }
    }

    async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const history = await testCaseService.getHistory(req.params.id, userId, role);
            sendResponse(res, 200, history, 'Test case history retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async move(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { targetSuiteId } = req.body;
            const testCase = await testCaseService.move(
                req.params.id,
                targetSuiteId,
                userId,
                role
            );
            sendResponse(res, 200, testCase, 'Test case moved successfully');
        } catch (error) {
            next(error);
        }
    }

    async addTags(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { tagIds } = req.body;
            await testCaseService.addTags(req.params.id, tagIds, userId, role);
            sendResponse(res, 200, null, 'Tags added successfully');
        } catch (error) {
            next(error);
        }
    }

    async removeTag(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            await testCaseService.removeTag(req.params.id, req.params.tagId, userId, role);
            sendResponse(res, 200, null, 'Tag removed successfully');
        } catch (error) {
            next(error);
        }
    }

    async bulkDelete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { ids, hardDelete } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return sendResponse(res, 400, null, 'No IDs provided');
            }
            await testCaseService.bulkDelete(ids, userId, role, hardDelete === true);
            sendResponse(res, 200, null, 'Test cases deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const { ids, status } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return sendResponse(res, 400, null, 'No IDs provided');
            }
            if (!status) {
                return sendResponse(res, 400, null, 'Status is required');
            }
            await testCaseService.bulkUpdateStatus(ids, status, userId, role);
            sendResponse(res, 200, null, 'Test cases updated successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const testCaseController = new TestCaseController();
