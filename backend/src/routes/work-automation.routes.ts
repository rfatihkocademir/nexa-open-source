import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { WorkAutomationController } from '../controllers/work-automation.controller';

const router = Router();
router.use(protect);
router.get('/', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), WorkAutomationController.list));
router.get('/executions', ...projectRoute('project.manage', projectResolvers.projectId(['query', 'projectId']), WorkAutomationController.executions));
router.post('/', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkAutomationController.create));
router.patch('/:id', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId'], ['query', 'projectId']), WorkAutomationController.update));
router.post('/:id/dry-run', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkAutomationController.dryRun));
router.post('/:id/run', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkAutomationController.run));
export default router;
