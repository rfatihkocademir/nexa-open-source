import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { WorkItemPolicyController } from '../controllers/work-item-policy.controller';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();
router.use(protect);
router.get('/project/:projectId', ...projectRoute('board.read', projectResolvers.projectId(['params', 'projectId'])), WorkItemPolicyController.list);
router.put('/project/:projectId/:itemType', ...projectRoute('board.manage', projectResolvers.projectId(['params', 'projectId'])), WorkItemPolicyController.upsert);
export default router;
