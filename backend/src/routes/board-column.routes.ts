import { Router } from 'express';
import { BoardColumnController } from '../controllers/board-column.controller';
import { protect as authenticate } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.post(
    '/',
    ...projectRoute('board.manage', projectResolvers.projectId(['body', 'projectId']), BoardColumnController.create)
);
router.post(
    '/apply-template',
    ...projectRoute('board.manage', projectResolvers.projectId(['body', 'projectId']), BoardColumnController.applyTemplate)
);
router.get(
    '/project/:projectId',
    ...projectRoute('board.read', projectResolvers.projectId(['params', 'projectId']), BoardColumnController.getByProjectId)
);
router.put(
    '/:id',
    ...projectRoute('board.manage', projectResolvers.boardColumnId('params', 'id'), BoardColumnController.update)
);
router.delete(
    '/:id',
    ...projectRoute('board.manage', projectResolvers.boardColumnId('params', 'id'), BoardColumnController.delete)
);
router.post(
    '/reorder',
    ...projectRoute('board.manage', projectResolvers.boardColumnIds('body', 'columns'), BoardColumnController.reorder)
);

export default router;
