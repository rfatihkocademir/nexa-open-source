import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { protect } from '../middlewares/auth.middleware';
import { authorize, projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { cacheMiddleware } from '../middlewares/cache.middleware';
import { createProjectSchema, updateProjectSchema, projectIdSchema } from '../validations/project.validation';
import businessRequestRoutes from './business-request.routes';

const router = Router();

router.use(protect);

router.route('/')
    .get(cacheMiddleware(300), projectController.getAll)
    .post(authorize('projects:create'), validate(createProjectSchema), projectController.create);

router.post('/ai/questions', authorize('projects:create'), projectController.generateQuestions);
router.post('/ai/scope', authorize('projects:create'), projectController.generateScope);
router.post('/ai/wiki', authorize('projects:create'), projectController.generateWiki);
router.post('/ai/documentation-suite', authorize('projects:create'), projectController.generateDocumentationSuite);
router.post('/ai/architecture-questions', authorize('projects:create'), projectController.generateArchitectureQuestions);
router.post('/ai/architecture', authorize('projects:create'), projectController.generateArchitectureDocument);


router.get('/warnings', authorize('projects:warnings'), projectController.getWarnings);
router.get('/available-teams', projectController.getAvailableTeams);

router.route('/:id')
    .get(validate(projectIdSchema), cacheMiddleware(300), projectController.getById)
    .patch(...projectRoute('project.update', projectResolvers.projectId(['params', 'id']), validate(updateProjectSchema), projectController.update))
    .delete(...projectRoute('project.manage', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.delete));

router.route('/:id/members')
    .post(...projectRoute('membership.manage', projectResolvers.projectId(['params', 'id']), projectController.addMember));

router.route('/:id/members/:userId')
    .delete(...projectRoute('membership.manage', projectResolvers.projectId(['params', 'id']), projectController.removeMember));

router.route('/:id/archive')
    .patch(...projectRoute('project.manage', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.archive));

router.route('/:id/unarchive')
    .patch(...projectRoute('project.manage', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.unarchive));

router.use('/:projectId/business-requests', businessRequestRoutes);

router.get('/:id/export-cases', ...projectRoute('test-scope.read', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.exportCases));

router.get('/:id/elements', ...projectRoute('project.read', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.getElements));
router.post('/:id/elements', ...projectRoute('project.update', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.saveElement));
router.delete('/:id/elements/:elementId', ...projectRoute('project.update', projectResolvers.projectId(['params', 'id']), validate(projectIdSchema), projectController.deleteElement));

export default router;
