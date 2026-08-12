import { Router } from 'express';
import { testResultController } from '../controllers/testResult.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { addResultSchema, addAutomationResultSchema } from '../validations/testResult.validation';

const router = Router();

router.use(protect);

router.post(
    '/:runItemId/results',
    ...projectRoute('execution.manual', projectResolvers.runItemId('params', 'runItemId'), validate(addResultSchema)),
    testResultController.addResult
);

router.patch(
    '/:runItemId/manual-result',
    ...projectRoute('execution.manual', projectResolvers.runItemId('params', 'runItemId'), validate(addResultSchema)),
    (req, res, next) => testResultController.addManualResult(req, res, next)
);

router.patch(
    '/:runItemId/automation-result',
    ...projectRoute('execution.automation', projectResolvers.runItemId('params', 'runItemId'), validate(addAutomationResultSchema)),
    (req, res, next) => testResultController.addAutomationResult(req, res, next)
);

export default router;
