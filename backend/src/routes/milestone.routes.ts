import { Router } from 'express';
import { milestoneController } from '../controllers/milestone.controller';
import { protect } from '../middlewares/auth.middleware';
import { authorize, projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createMilestoneSchema, updateMilestoneSchema, milestoneIdSchema } from '../validations/milestone.validation';

const router = Router();

router.use(protect);

router.route('/')
    .get(...projectRoute('project.read', projectResolvers.projectId(['query', 'projectId']), milestoneController.getAll))
    .post(authorize('milestones:create'), validate(createMilestoneSchema), milestoneController.create);

router.route('/:id')
    .get(validate(milestoneIdSchema), milestoneController.getById)
    .patch(authorize('milestones:update'), validate(updateMilestoneSchema), milestoneController.update)
    .delete(authorize('milestones:delete'), validate(milestoneIdSchema), milestoneController.delete);

router.patch('/:id/restore', authorize('milestones:update'), milestoneController.restore);

export default router;
