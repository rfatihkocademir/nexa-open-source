import { Request, Response, NextFunction } from 'express';
import { oidcService } from '../services/oidc.service';
import prisma from '../utils/prisma';

const refreshCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1/auth', maxAge: 30 * 24 * 60 * 60 * 1000 };
const accessCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1', maxAge: 15 * 60 * 1000 };
const oidcStateCookie = 'nexa_oidc_state';
const oidcStateCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/v1/auth/oidc', maxAge: 10 * 60 * 1000 };

const readCookie = (req: Request, name: string) => req.headers.cookie?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);

export const oidcController = {
    async providers(req: Request, res: Response, next: NextFunction) {
        try {
            const domain = typeof req.query.domain === 'string' ? req.query.domain.toLowerCase().trim() : '';
            if (!domain) return res.json({ success: true, data: [] });
            const providers = await prisma.oidcProvider.findMany({ where: { isActive: true, allowedDomains: { has: domain } }, select: { id: true, name: true } });
            return res.json({ success: true, data: providers });
        } catch (error) { return next(error); }
    },
    async start(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await oidcService.start(req.params.providerId);
            res.cookie(oidcStateCookie, result.state, oidcStateCookieOptions);
            return res.redirect(result.authorizationUrl);
        } catch (error) { return next(error); }
    },
    async callback(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await oidcService.callback(
                req.params.providerId,
                req.originalUrl,
                { ip: req.ip, userAgent: req.headers['user-agent'] },
                readCookie(req, oidcStateCookie),
            );
            res.cookie('nexa_refresh', result.refreshToken, refreshCookieOptions);
            res.cookie('nexa_access', result.token, accessCookieOptions);
            const target = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
            target.pathname = '/auth/callback';
            return res.redirect(target.toString());
        } catch (error) { return next(error); }
        finally { res.clearCookie(oidcStateCookie, oidcStateCookieOptions); }
    },
};
