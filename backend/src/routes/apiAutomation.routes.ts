import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { apiAutomationController } from '../controllers/apiAutomation.controller';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validate } from '../middlewares/validate.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { apiExecutionSchema, apiAutomationTextSchema } from '../validations/apiAutomation.validation';

const router = Router();

const apiExecutionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
});

const apiAutomationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/execute-step', protect, apiExecutionLimiter, validate(apiExecutionSchema),
  ...projectRoute('execution.automation', projectResolvers.projectId(['body', 'projectId']), (req, res) => apiAutomationController.executeStep(req, res)));
router.post('/parse-curl', protect, apiAutomationLimiter, validate(apiAutomationTextSchema), (req, res) => apiAutomationController.parseCurl(req, res));
router.post('/import-swagger', protect, apiAutomationLimiter, (req, res) => apiAutomationController.importSwagger(req, res));
router.post('/generate-ai-api', protect, apiAutomationLimiter, validate(apiAutomationTextSchema), (req, res) => apiAutomationController.generateAiApi(req, res));

export default router;
