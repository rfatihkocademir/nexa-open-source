import { Router } from 'express';
import { jiraMigrationController } from '../controllers/jiraMigration.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

router.post('/import-json', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), (req, res, next) => jiraMigrationController.importFromJson(req, res, next)));
router.post('/import-api', ...projectRoute('project.manage', projectResolvers.projectId(['body', 'projectId']), (req, res, next) => jiraMigrationController.importFromJiraApi(req, res, next)));

export default router;
