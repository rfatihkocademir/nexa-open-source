import { Router } from 'express';
import { integrationController } from '../controllers/integration.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(protect);

router.get(
    '/',
    ...projectRoute('integration.read', projectResolvers.projectId(['params', 'projectId']), integrationController.getIntegrations)
);
router.post(
    '/',
    ...projectRoute('integration.manage', projectResolvers.projectId(['params', 'projectId']), integrationController.createIntegration)
);
router.put(
    '/:id',
    ...projectRoute('integration.manage', projectResolvers.projectId(['params', 'projectId']), integrationController.updateIntegration)
);
router.delete(
    '/:id',
    ...projectRoute('integration.manage', projectResolvers.projectId(['params', 'projectId']), integrationController.deleteIntegration)
);

export default router;
