import { Router } from 'express';
import { DashboardStudioController } from '../controllers/dashboard-studio.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
router.use(protect);
router.get('/catalog', DashboardStudioController.catalog);
router.get('/', DashboardStudioController.list);
router.post('/', DashboardStudioController.create);
router.post('/ensure-default', DashboardStudioController.ensureDefault);
router.get('/:id/data', DashboardStudioController.data);
router.patch('/:id', DashboardStudioController.update);
router.put('/:id/layout', DashboardStudioController.saveLayout);
router.put('/:id/default', DashboardStudioController.setDefault);
router.delete('/:id', DashboardStudioController.archive);

export default router;
