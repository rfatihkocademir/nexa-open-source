import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { protectedProjectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });
const analyticsController = new AnalyticsController();

router.get('/traceability', ...protectedProjectRoute('project.read', projectResolvers.projectId(['params', 'projectId']), analyticsController.getTraceabilityMatrix.bind(analyticsController)));
router.get('/quality', ...protectedProjectRoute('project.read', projectResolvers.projectId(['params', 'projectId']), analyticsController.getQualityDashboard.bind(analyticsController)));

export default router;
