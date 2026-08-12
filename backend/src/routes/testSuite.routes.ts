import { Router } from 'express';
import { testSuiteController } from '../controllers/testSuite.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createSuiteSchema, updateSuiteSchema, suiteIdSchema } from '../validations/testSuite.validation';

const router = Router();

router.use(protect);

router.route('/')
    .get(...projectRoute('test-scope.read', projectResolvers.projectId(['query', 'projectId']), testSuiteController.getAll))
    .post(...projectRoute('test-scope.create', projectResolvers.projectId(['body', 'projectId']), validate(createSuiteSchema), testSuiteController.create));

router.route('/:id')
    .get(...projectRoute('test-scope.read', projectResolvers.suiteId('params', 'id'), validate(suiteIdSchema), testSuiteController.getById))
    .patch(...projectRoute('test-scope.update', projectResolvers.suiteId('params', 'id'), validate(updateSuiteSchema), testSuiteController.update))
    .delete(...projectRoute('test-scope.update', projectResolvers.suiteId('params', 'id'), validate(suiteIdSchema), testSuiteController.delete));

router.route('/:id/restore')
    .post(...projectRoute('quality.approve', projectResolvers.suiteId('params', 'id'), validate(suiteIdSchema), testSuiteController.restore));

export default router;
