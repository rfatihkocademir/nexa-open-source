import { Router } from 'express';
import { PromptController } from '../controllers/prompt.controller';
import { protect } from '../middlewares/auth.middleware';
import { restrictTo } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { activatePromptVersionSchema, addPromptVersionSchema, createPromptTemplateSchema } from '../validations/prompt.validation';

const router = Router();

router.use(protect);

router.get('/', PromptController.listTemplates);
router.get('/:slug', PromptController.getTemplateDetails);

// Only admins can manage prompt templates and versions
router.post('/', restrictTo('ADMIN'), validate(createPromptTemplateSchema), PromptController.createTemplate);
router.post('/:slug/versions', restrictTo('ADMIN'), validate(addPromptVersionSchema), PromptController.addVersion);
router.post('/:slug/activate', restrictTo('ADMIN'), validate(activatePromptVersionSchema), PromptController.activateVersion);

export default router;
