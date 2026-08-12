import { Router } from 'express';
import { testRunController } from '../controllers/testRun.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createTestRunSchema, testRunIdSchema } from '../validations/testRun.validation';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { cacheMiddleware } from '../middlewares/cache.middleware';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();
const automationExecutionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(protect);

router.route('/')
    .get(...projectRoute('run.read', projectResolvers.projectId(['query', 'projectId']), cacheMiddleware(60), testRunController.getAll))
    .post(...projectRoute('run.create', projectResolvers.projectId(['body', 'projectId']), validate(createTestRunSchema), testRunController.create));

router.get('/:id/conflicts', ...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.getConflicts));
router.get('/:id/report', ...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.getReport));
router.get('/:id/comparison-report', ...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.getComparisonReport));
router.get('/:id/export-results', ...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.exportResults));
router.get('/:id/export-comparison', ...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.exportComparison));
router.post('/:id/execute-automation', automationExecutionLimiter, ...projectRoute('execution.automation', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.triggerAutomation));
router.post('/:id/notify-completion', ...projectRoute('run.manage', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.notifyCompletion));
router.post('/:id/items', ...projectRoute('run.update', projectResolvers.testRunId('params', 'id'), testRunController.addItems));
router.post('/items/:itemId/trigger', automationExecutionLimiter, ...projectRoute('execution.automation', projectResolvers.runItemId('params', 'itemId'), testRunController.triggerItemAutomation));
router.delete('/items/:itemId', ...projectRoute('run.manage', projectResolvers.runItemId('params', 'itemId'), testRunController.deleteItem));
router.post('/quick-run', automationExecutionLimiter, ...projectRoute('run.create', projectResolvers.projectId(['body', 'projectId']), testRunController.createQuickRun));

router.route('/:id')
    .get(...projectRoute('run.read', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.getById))
    .patch(...projectRoute('run.update', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.update))
    .delete(...projectRoute('run.manage', projectResolvers.testRunId('params', 'id'), validate(testRunIdSchema), testRunController.delete));

export default router;
