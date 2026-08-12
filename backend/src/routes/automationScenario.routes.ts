import { Router } from 'express';
import { automationScenarioController } from '../controllers/automationScenario.controller';
import { validate } from '../middlewares/validate.middleware';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
    createAutomationScenarioSchema,
    updateAutomationScenarioSchema,
    automationScenarioIdSchema,
    getByTestCaseIdSchema,
    dryRunAutomationScenarioSchema,
    dryRunIdSchema,
    cleanupAutomationVideoSchema,
} from '../validations/automationScenario.validation';

const router = Router();

const dryRunLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(protect);

router.post('/', validate(createAutomationScenarioSchema), automationScenarioController.create);
router.post(
    '/dry-run',
    dryRunLimiter,
    validate(dryRunAutomationScenarioSchema),
    ...projectRoute('execution.automation', projectResolvers.projectId(['body', 'projectId']), automationScenarioController.dryRun),
);
router.post(
    '/dry-run/start',
    dryRunLimiter,
    validate(dryRunAutomationScenarioSchema),
    ...projectRoute('execution.automation', projectResolvers.projectId(['body', 'projectId']), automationScenarioController.startDryRun),
);
router.get(
    '/dry-run/:dryRunId/frame',
    validate(dryRunIdSchema),
    automationScenarioController.getLiveFrame
);
router.get(
    '/dry-run/:dryRunId',
    validate(dryRunIdSchema),
    automationScenarioController.getDryRunStatus
);
router.delete(
    '/dry-run/:dryRunId',
    validate(dryRunIdSchema),
    automationScenarioController.clearDryRun
);
router.post(
    '/cleanup-video',
    validate(cleanupAutomationVideoSchema),
    ...projectRoute('execution.automation', projectResolvers.projectId(['body', 'projectId']), automationScenarioController.cleanupVideo),
);
router.post('/:id/publish', validate(automationScenarioIdSchema), automationScenarioController.publish);
router.get('/:id', validate(automationScenarioIdSchema), automationScenarioController.getById);
router.get('/testcase/:testCaseId', validate(getByTestCaseIdSchema), automationScenarioController.getByTestCaseId);
router.patch('/:id', validate(updateAutomationScenarioSchema), automationScenarioController.update);
router.delete('/:id', validate(automationScenarioIdSchema), automationScenarioController.delete);

export default router;
