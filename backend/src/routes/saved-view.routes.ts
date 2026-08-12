import { Router } from 'express';
import { SavedViewController } from '../controllers/saved-view.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

router.get('/', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), SavedViewController.list));
router.post('/', ...projectRoute('backlog.read', projectResolvers.projectId(['body', 'projectId']), SavedViewController.create));
router.delete('/:id', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), SavedViewController.delete));

export default router;
