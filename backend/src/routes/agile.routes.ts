import { Router } from 'express';
import { AgileController } from '../controllers/agile.controller';
import { protectedProjectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });
const agileController = new AgileController();

// Board data
router.get(
    '/projects/:projectId/agile/board',
    ...protectedProjectRoute('board.read', projectResolvers.projectId(['params', 'projectId']), agileController.getBoard)
);

// Move item between columns (status-aware)
router.put(
    '/agile/move/:type/:id',
    ...protectedProjectRoute('board.move', projectResolvers.workItemId('params', 'id'), agileController.moveItem)
);

// Sprint completion flow
router.get(
    '/agile/sprints/:sprintId/completion-stats',
    ...protectedProjectRoute('sprint.manage', projectResolvers.sprintId('params', 'sprintId'), agileController.getSprintCompletionStats)
);

router.post(
    '/agile/sprints/:sprintId/complete',
    ...protectedProjectRoute('sprint.manage', projectResolvers.sprintId('params', 'sprintId'), agileController.completeSprint)
);

export default router;
