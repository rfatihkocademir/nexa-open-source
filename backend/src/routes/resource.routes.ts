import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { resourceController } from '../controllers/resource.controller';

const router = Router();
router.use(protect);
router.get('/projects/:key', resourceController.resolveProject.bind(resourceController));
router.get('/:key', resourceController.resolve.bind(resourceController));

export default router;
