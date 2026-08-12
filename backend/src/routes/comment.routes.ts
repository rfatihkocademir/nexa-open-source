import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { protect as authenticate } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.post('/', ...projectRoute('backlog.update', projectResolvers.workItemIdCandidates(['body', 'workItemId'], ['body', 'storyId'], ['body', 'taskId'], ['body', 'bugId']), CommentController.create));
router.get('/workitem/:workItemId', ...projectRoute('backlog.read', projectResolvers.workItemId('params', 'workItemId'), CommentController.getByWorkItemId));

export default router;
