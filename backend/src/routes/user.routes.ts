import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';

const router = Router();

// Protect all routes after this middleware
router.use(protect);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);

// Admin only routes
router.get('/:id', authorize('users:read'), userController.getById);
router.get('/', authorize('users:read'), userController.getAllUsers);
router.post('/', authorize('users:create'), userController.create);
router.patch('/:id', authorize('users:update'), userController.update);
router.delete('/:id', authorize('users:delete'), userController.delete);

export default router;
