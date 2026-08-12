import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema, tokenSchema } from '../validations/auth.validation';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/auth.middleware';
import { oidcController } from '../controllers/oidc.controller';

const router = Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later',
});
const sessionRefreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many session refresh attempts, please try again later',
});

router.post('/register', authLimiter, (req, res, next) => {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
        res.status(403).json({ success: false, message: 'Public registration is disabled' });
        return;
    }
    next();
}, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', sessionRefreshLimiter, authController.refresh);
router.post('/forgot-password', authLimiter, validate(resetRequestSchema), authController.requestPasswordReset);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', authLimiter, validate(tokenSchema), authController.verifyEmail);
router.post('/logout', authController.logout);
router.post('/logout-all', protect, authController.logoutAll);
router.get('/sessions', protect, authController.sessions);
router.post('/mfa/setup', protect, authController.beginMfa);
router.post('/mfa/confirm', protect, validate(tokenSchema), authController.confirmMfa);
router.post('/mfa/disable', protect, validate(tokenSchema), authController.disableMfa);
router.get('/oidc/:providerId/start', oidcController.start);
router.get('/oidc/:providerId/callback', oidcController.callback);
router.get('/oidc-providers', oidcController.providers);

export default router;
