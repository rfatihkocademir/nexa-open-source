
import { Router } from 'express';
import { WorklogController } from '../controllers/worklog.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', WorklogController.create);
router.get('/test-me', (req, res) => { res.json({ message: "HELLO FROM TEST ME" }); });
router.get('/weekly-summary', WorklogController.weeklySummary);
router.get('/timesheet', WorklogController.getTimesheet);
router.get('/', WorklogController.getAll);
router.patch('/:id', WorklogController.update);
router.delete('/:id', WorklogController.delete);

export default router;
