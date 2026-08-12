import { Request, Response } from 'express';
import { TraceabilityService } from '../services/traceability.service';
import { qualityDashboardService } from '../services/quality-dashboard.service';
import { respondWithControllerError } from '../utils/controllerError';
import { getAuthorizedProjectActor } from '../utils/requestContext';

const traceabilityService = new TraceabilityService();

export class AnalyticsController {
    async getTraceabilityMatrix(req: Request, res: Response) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const { sprintId, epicId } = req.query;

            const data = await traceabilityService.getTraceabilityMatrix(projectId, userId, role, {
                sprintId: sprintId as string,
                parentId: epicId as string
            });

            const stats = await traceabilityService.getCoverageStatistics(projectId, userId, role);
            const gaps = await traceabilityService.getTraceabilityGaps(projectId, userId, role);

            res.json({ matrix: data, stats, gaps });
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch traceability matrix');
        }
    }

    async getQualityDashboard(req: Request, res: Response) {
        try {
            const { userId, role, projectId } = getAuthorizedProjectActor(req, req.params.projectId);
            const data = await qualityDashboardService.getDashboardMetrics(projectId, userId, role);
            res.json(data);
        } catch (error) {
            respondWithControllerError(res, error, 'Failed to fetch quality dashboard metrics');
        }
    }
}
