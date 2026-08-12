import { Router } from 'express';
import { RequirementController } from '../controllers/requirement.controller';
import { protectedProjectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

// Base permissions: requirements inherit from backlog permissions for now
router.get('/', ...protectedProjectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), RequirementController.findByProject));
router.post('/', ...protectedProjectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), RequirementController.create));
router.get('/:id', ...protectedProjectRoute('backlog.read', projectResolvers.requirementId('params', 'id'), RequirementController.findById));
router.get('/:id/testability', ...protectedProjectRoute('backlog.read', projectResolvers.requirementId('params', 'id'), RequirementController.analyzeTestability));
router.patch('/:id/status', ...protectedProjectRoute('backlog.update', projectResolvers.requirementId('params', 'id'), RequirementController.updateStatus));

export default router;
