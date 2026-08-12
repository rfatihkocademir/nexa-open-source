import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { WorkflowSchemeController } from '../controllers/workflow-scheme.controller';

const router = Router();
router.use(protect);
router.get('/', ...projectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), WorkflowSchemeController.get));
router.post('/validate', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkflowSchemeController.validate));
router.put('/draft', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkflowSchemeController.saveDraft));
router.post('/draft/from-live', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkflowSchemeController.refreshDraft));
router.post('/publish', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkflowSchemeController.publish));
router.post('/revisions/:revisionId/restore', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), WorkflowSchemeController.restore));
export default router;
