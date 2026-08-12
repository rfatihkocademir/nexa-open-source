import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sendResponse } from '../utils/apiResponse';
import { sessionService } from '../services/session.service';

const REFRESH_COOKIE = 'nexa_refresh';
const ACCESS_COOKIE = 'nexa_access';
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
});
const accessCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1',
    maxAge: 15 * 60 * 1000,
});
const metadata = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const readCookie = (req: Request) => req.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1);

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.register(req.body, metadata(req));
            if ('refreshToken' in result) res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
            if ('token' in result) res.cookie(ACCESS_COOKIE, result.token, accessCookieOptions());
            const response = { ...result, ...('refreshToken' in result ? { refreshToken: undefined } : {}) };
            sendResponse(res, 201, response, 'Registration successful');
        } catch (error) {
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.login(req.body, metadata(req));
            res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
            res.cookie(ACCESS_COOKIE, result.token, accessCookieOptions());
            const { refreshToken: _refreshToken, ...response } = result;
            sendResponse(res, 200, response, 'Login successful');
        } catch (error) {
            next(error);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const token = readCookie(req);
            if (!token) return res.status(401).json({ success: false, message: 'Refresh session is required' });
            const result = await sessionService.rotate(token, metadata(req));
            res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
            res.cookie(ACCESS_COOKIE, result.token, accessCookieOptions());
            const { refreshToken: _refreshToken, ...response } = result;
            return sendResponse(res, 200, response, 'Session refreshed');
        } catch (error) { return next(error); }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            await sessionService.revoke(readCookie(req));
            res.clearCookie(REFRESH_COOKIE, cookieOptions());
            res.clearCookie(ACCESS_COOKIE, accessCookieOptions());
            return sendResponse(res, 200, null, 'Logged out');
        } catch (error) { return next(error); }
    }

    async logoutAll(req: Request, res: Response, next: NextFunction) {
        try {
            await sessionService.revoke(undefined, req.user!.id, true);
            res.clearCookie(REFRESH_COOKIE, cookieOptions());
            res.clearCookie(ACCESS_COOKIE, accessCookieOptions());
            return sendResponse(res, 200, null, 'Logged out from all sessions');
        } catch (error) { return next(error); }
    }

    async sessions(req: Request, res: Response, next: NextFunction) {
        try { return sendResponse(res, 200, await sessionService.list(req.user!.id), 'Sessions retrieved'); }
        catch (error) { return next(error); }
    }

    async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
        try { await authService.requestPasswordReset(req.body.email); return sendResponse(res, 202, null, 'If the account exists, reset instructions were sent'); }
        catch (error) { return next(error); }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try { await authService.resetPassword(req.body.token, req.body.password); return sendResponse(res, 200, null, 'Password reset'); }
        catch (error) { return next(error); }
    }

    async verifyEmail(req: Request, res: Response, next: NextFunction) {
        try { await authService.verifyEmail(req.body.token); return sendResponse(res, 200, null, 'Email verified'); }
        catch (error) { return next(error); }
    }

    async beginMfa(req: Request, res: Response, next: NextFunction) {
        try { return sendResponse(res, 200, await authService.beginMfaSetup(req.user!.id), 'MFA setup started'); }
        catch (error) { return next(error); }
    }

    async confirmMfa(req: Request, res: Response, next: NextFunction) {
        try { await authService.confirmMfa(req.user!.id, req.body.token); return sendResponse(res, 200, null, 'MFA enabled'); }
        catch (error) { return next(error); }
    }

    async disableMfa(req: Request, res: Response, next: NextFunction) {
        try { await authService.disableMfa(req.user!.id, req.body.token); return sendResponse(res, 200, null, 'MFA disabled'); }
        catch (error) { return next(error); }
    }
}

export const authController = new AuthController();
