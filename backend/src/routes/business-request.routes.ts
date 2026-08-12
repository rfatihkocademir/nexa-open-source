import { Router } from 'express';
import { businessRequestController } from '../controllers/business-request.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(protect);

router.get('/', ...projectRoute('request.read', projectResolvers.projectId(['params', 'projectId'], ['query', 'projectId']), businessRequestController.getAll));
router.post('/', ...projectRoute('request.create', projectResolvers.projectId(['params', 'projectId'], ['body', 'projectId']), businessRequestController.create));
router.get('/:id', ...projectRoute('request.read', projectResolvers.businessRequestId('params', 'id'), businessRequestController.getById));
router.get('/:id/guidance', ...projectRoute('request.read', projectResolvers.businessRequestId('params', 'id'), businessRequestController.getGuidance));
router.patch('/:id', ...projectRoute('request.update', projectResolvers.businessRequestId('params', 'id'), businessRequestController.update));
router.post('/:id/analyze', ...projectRoute('analysis.run', projectResolvers.businessRequestId('params', 'id'), businessRequestController.analyze));
router.post('/:id/approve', ...projectRoute('request.approve', projectResolvers.businessRequestId('params', 'id'), businessRequestController.approve));
router.delete('/:id', ...projectRoute('project.manage', projectResolvers.businessRequestId('params', 'id'), businessRequestController.delete));

export default router;
