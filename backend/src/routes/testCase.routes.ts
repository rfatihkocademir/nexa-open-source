import { Router } from 'express';
import { testCaseController } from '../controllers/testCase.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createTestCaseSchema, updateTestCaseSchema, testCaseIdSchema } from '../validations/testCase.validation';

const router = Router();

router.use(protect);

router.get('/search', ...projectRoute('test-scope.read', projectResolvers.projectId(['query', 'projectId']), testCaseController.getAllByProject));
router.get('/key/:key', testCaseController.getByKey);

router.route('/')
    .get(...projectRoute('test-scope.read', projectResolvers.suiteId('query', 'suiteId'), testCaseController.getAll))
    .post(...projectRoute('test-scope.create', projectResolvers.testCaseCreate(), validate(createTestCaseSchema), testCaseController.create));

router.route('/:id')
    .get(...projectRoute('test-scope.read', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.getById))
    .patch(...projectRoute('test-scope.update', projectResolvers.testCaseId('params', 'id'), validate(updateTestCaseSchema), testCaseController.update))
    .delete(...projectRoute('quality.approve', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.delete));

router.post('/:id/restore', ...projectRoute('quality.approve', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.restore));
router.post('/:id/revert/:version', ...projectRoute('test-scope.update', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.revert));

router.get('/:id/history', ...projectRoute('test-scope.read', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.getHistory));

router.patch('/:id/approve', ...projectRoute('test-case.approve', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.approve));
router.patch('/:id/request-revision', ...projectRoute('quality.approve', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.requestRevision));
router.post('/bulk/delete', ...projectRoute('quality.approve', projectResolvers.testCaseIds('body', 'ids'), testCaseController.bulkDelete));
router.post('/bulk/status', ...projectRoute('test-scope.update', projectResolvers.testCaseIds('body', 'ids'), testCaseController.bulkUpdateStatus));

router.patch('/:id/move', ...projectRoute('test-scope.update', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.move));
router.post('/:id/tags', ...projectRoute('test-scope.update', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.addTags));
router.delete('/:id/tags/:tagId', ...projectRoute('test-scope.update', projectResolvers.testCaseId('params', 'id'), validate(testCaseIdSchema), testCaseController.removeTag));

export default router;
