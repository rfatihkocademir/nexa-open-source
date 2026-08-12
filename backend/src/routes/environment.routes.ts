import { Router } from 'express';
import { EnvironmentController } from '../controllers/environment.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

// Project specific environments
router.get(
    '/project/:projectId',
    ...projectRoute('project.read', projectResolvers.projectId(['params', 'projectId']), EnvironmentController.findAll)
);
router.post(
    '/project/:projectId',
    ...projectRoute('project.update', projectResolvers.projectId(['params', 'projectId']), EnvironmentController.create)
);
router.post(
    '/project/:projectId/defaults',
    ...projectRoute('project.update', projectResolvers.projectId(['params', 'projectId']), EnvironmentController.ensureDefaults)
);

// Individual environment operations
router.patch(
    '/:id',
    ...projectRoute('project.update', projectResolvers.environmentId('params', 'id'), EnvironmentController.update)
);
router.delete(
    '/:id',
    ...projectRoute('project.update', projectResolvers.environmentId('params', 'id'), EnvironmentController.delete)
);

export default router;
