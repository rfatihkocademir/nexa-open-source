import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { EnterpriseMigrationController } from '../controllers/enterprise-migration.controller';

const router = Router();
router.use(protect);
router.get('/', ...projectRoute('project.manage', projectResolvers.projectId(['query', 'projectId']), EnterpriseMigrationController.list));
router.get('/:jobId/report', ...projectRoute('project.manage', projectResolvers.projectId(['query', 'projectId']), EnterpriseMigrationController.report));
router.get('/:jobId', ...projectRoute('project.manage', projectResolvers.projectId(['query', 'projectId']), EnterpriseMigrationController.get));
router.post('/jira/test', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.testJira));
router.post('/jira/analyze', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.analyzeJira));
router.post('/xray/test', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.testXray));
router.post('/jira-xray/analyze', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.analyzeJiraXray));
router.post('/analyze', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.analyze));
router.post('/:jobId/dry-run', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.dryRun));
router.post('/:jobId/execute', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), EnterpriseMigrationController.execute));
export default router;
