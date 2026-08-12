import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { analyticsService } from '../services/analytics.service';
import { sendResponse } from '../utils/apiResponse';
import { ProjectAccess } from '../utils/projectAccess';
import { getRequestActor } from '../utils/requestContext';

export class DashboardController {
    async getMyWorkQueue(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const queue = await dashboardService.getMyWorkQueue(userId, role, organizationId);
            sendResponse(res, 200, queue, 'Personal work queue retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getExecutionSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const summary = await dashboardService.getExecutionSummary(userId, role, organizationId);
            sendResponse(res, 200, summary, 'Execution summary retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getWorkspaceOverview(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const overview = await dashboardService.getWorkspaceOverview(userId, role, organizationId);
            sendResponse(res, 200, overview, 'Workspace overview retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            if (!projectId) {
                return sendResponse(res, 400, null, 'Project ID is required');
            }

            await ProjectAccess.check(projectId, userId, role);

            const stats = await dashboardService.getProjectStats(projectId);
            sendResponse(res, 200, stats, 'Dashboard stats retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getManagementMetrics(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            const timeframe = (req.query.timeframe as 'WEEK' | 'SPRINT' | 'MONTH') || 'WEEK';
            if (!projectId) {
                return sendResponse(res, 400, null, 'Project ID is required');
            }

            const metrics = await analyticsService.getManagementMetrics(projectId, userId, role, timeframe);
            sendResponse(res, 200, metrics, 'Management metrics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getPerformanceMetrics(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role } = getRequestActor(req);
            const projectId = req.query.projectId as string;
            const timeframe = (req.query.timeframe as 'WEEK' | 'SPRINT' | 'MONTH') || 'WEEK';
            if (!projectId) {
                return sendResponse(res, 400, null, 'Project ID is required');
            }

            const metrics = await analyticsService.getPerformanceMetrics(projectId, userId, role, timeframe);
            sendResponse(res, 200, metrics, 'Performance metrics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
    async getRecentActivities(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const activities = await dashboardService.getRecentActivities(userId, role, organizationId);
            sendResponse(res, 200, activities, 'Recent activities retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async globalSearch(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, role, organizationId } = getRequestActor(req);
            const query = req.query.q as string;
            if (!query || query.trim().length < 2) {
                return sendResponse(res, 200, [], 'Query too short');
            }
            const results = await dashboardService.globalSearch(query, userId, role, organizationId);
            sendResponse(res, 200, results, 'Search results retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
}

export const dashboardController = new DashboardController();
