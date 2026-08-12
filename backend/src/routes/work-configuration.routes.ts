import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { WorkConfigurationController } from '../controllers/work-configuration.controller';

const router = Router();
router.use(protect);

router.get('/', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), WorkConfigurationController.list));
router.post('/work-types', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkConfigurationController.createWorkType));
router.patch('/work-types/:id', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId'], ['query', 'projectId']), WorkConfigurationController.updateWorkType));
router.post('/custom-fields', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkConfigurationController.createCustomField));
router.patch('/custom-fields/:id', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId'], ['query', 'projectId']), WorkConfigurationController.updateCustomField));
router.delete('/custom-fields/:id', ...projectRoute('project.manage', projectResolvers.projectId(['query', 'projectId']), WorkConfigurationController.deleteCustomField));

export default router;
