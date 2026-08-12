import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { protect } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

router.get('/overview', dashboardController.getWorkspaceOverview);
router.get('/my-work', dashboardController.getMyWorkQueue);
router.get('/execution-summary', dashboardController.getExecutionSummary);
router.get('/stats', dashboardController.getStats);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/search', dashboardController.globalSearch);
router.get('/management', authorize('dashboard:management'), dashboardController.getManagementMetrics);
router.get('/performance', authorize('dashboard:performance'), dashboardController.getPerformanceMetrics);

export default router;
