import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

router.post('/', ...projectRoute('project.update', projectResolvers.projectId(['body', 'projectId']), tagController.create));
router.get('/', ...projectRoute('project.read', projectResolvers.projectId(['query', 'projectId']), tagController.getByProject));
router.patch('/:id', ...projectRoute('project.update', projectResolvers.tagId('params', 'id'), tagController.update));
router.delete('/:id', ...projectRoute('project.update', projectResolvers.tagId('params', 'id'), tagController.delete));

export default router;
