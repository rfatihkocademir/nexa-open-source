import { Router } from 'express';
import { scenarioStepController } from '../controllers/scenarioStep.controller';
import { validate } from '../middlewares/validate.middleware';
import { protect } from '../middlewares/auth.middleware';
import {
    addStepToScenarioSchema,
    removeStepFromScenarioSchema,
    reorderStepsSchema,
    getScenarioStepsSchema,
} from '../validations/scenarioStep.validation';

const router = Router();

router.use(protect);

router.post('/', validate(addStepToScenarioSchema), scenarioStepController.addStep);
router.get('/scenario/:scenarioId', validate(getScenarioStepsSchema), scenarioStepController.getSteps);
router.delete('/:id', validate(removeStepFromScenarioSchema), scenarioStepController.removeStep);
router.patch('/reorder', validate(reorderStepsSchema), scenarioStepController.reorderSteps);

export default router;
