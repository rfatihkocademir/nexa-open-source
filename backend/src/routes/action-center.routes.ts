import { Router } from 'express';
import { ActionCenterController } from '../controllers/action-center.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);
router.get('/', ActionCenterController.list);
router.get('/summary', ActionCenterController.summary);
router.post('/reconcile', ActionCenterController.reconcile);
router.post('/bulk', ActionCenterController.bulkUpdate);
router.patch('/:id', ActionCenterController.update);
router.post('/:id/convert-to-work-item', ActionCenterController.convertToWorkItem);

export default router;
