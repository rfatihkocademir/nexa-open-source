import { Router } from 'express';
import { automationStepController } from '../controllers/automationStep.controller';
import { validate } from '../middlewares/validate.middleware';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import {
    createAutomationStepSchema,
    updateAutomationStepSchema,
    getAutomationStepsByProjectSchema,
    automationStepIdSchema,
    suggestAutomationStepsSchema,
} from '../validations/automationStep.validation';

const router = Router();

router.use(protect);

router.post('/', validate(createAutomationStepSchema), automationStepController.create);
router.post(
    '/suggest',
    validate(suggestAutomationStepsSchema),
    ...projectRoute('project.read', projectResolvers.projectId(['body', 'projectId']), automationStepController.suggest),
);
router.get('/', validate(getAutomationStepsByProjectSchema), automationStepController.getByProject);
router.get('/:id', validate(automationStepIdSchema), automationStepController.getById);
router.patch('/:id', validate(updateAutomationStepSchema), automationStepController.update);
router.delete('/:id', validate(automationStepIdSchema), automationStepController.delete);

export default router;
