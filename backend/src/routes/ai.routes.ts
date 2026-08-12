import { Router } from 'express';
import * as AIController from '../controllers/ai.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { generateStoriesSchema, generateStepsSchema } from '../validations/ai.validation';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Protect all AI routes
router.use(protect);
router.use(aiLimiter);

router.post('/analyze', ...projectRoute('analysis.run', projectResolvers.projectId(['body', 'projectId']), AIController.analyzeRequirement));
router.post(
    '/generate-stories',
    validate(generateStoriesSchema),
    ...projectRoute('analysis.run', projectResolvers.projectId(['body', 'projectId']), AIController.generateStories),
);
router.post(
    '/generate-steps',
    validate(generateStepsSchema),
    ...projectRoute('project.read', projectResolvers.projectId(['body', 'projectId']), AIController.generateSteps),
);
router.post('/generate-tests-from-story', ...projectRoute('analysis.run', projectResolvers.workItemIdCandidates(['body', 'storyId']), AIController.generateTestsFromStory));
router.post('/test-results/:testResultId/analyze-failure', ...projectRoute('analysis.run', projectResolvers.testResultId('params', 'testResultId'), AIController.analyzeFailure));
router.post('/:projectId/batch-create', ...projectRoute('backlog.create', projectResolvers.projectId(['params', 'projectId']), AIController.createBatch));
router.post('/:projectId/chat', ...projectRoute('project.read', projectResolvers.projectId(['params', 'projectId']), AIController.chatWithAssistant));
router.post('/:projectId/sync-knowledge', ...projectRoute('project.read', projectResolvers.projectId(['params', 'projectId']), AIController.syncKnowledge));
router.post('/:projectId/extract-elements', ...projectRoute('project.update', projectResolvers.projectId(['params', 'projectId']), AIController.extractElements));

export default router;
