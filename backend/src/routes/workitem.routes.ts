import { Router } from 'express';
import { WorkItemController } from '../controllers/workitem.controller';
import { protect as authenticate } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.post('/', ...projectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), WorkItemController.create));
router.get('/', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), WorkItemController.getAll));
router.get('/search/nql', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), WorkItemController.search));
router.get('/:id', ...projectRoute('backlog.read', projectResolvers.workItemId('params', 'id'), WorkItemController.getById));
router.put('/:id', ...projectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.patch('/:id', ...projectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.delete('/:id', ...projectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.delete));
router.patch('/:id/restore', ...projectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.restore));

export default router;
