import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import prisma from '../utils/prisma';
import { expandPermissionKeys } from '../utils/permissionCatalog';
import { securityPolicyService } from '../services/security-policy.service';
import { operationalResilienceService } from '../services/operational-resilience.service';

interface JwtPayload {
    id: string;
    role: string;
    organizationId?: string | null;
    sessionId?: string;
    tokenVersion?: number;
}

type AuthenticatedUser = {
    id: string;
    role: string;
    permissions: string[];
    organizationId: string | null;
};

const resolveUserFromToken = async (token: string, requestIp?: string): Promise<AuthenticatedUser> => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
            organizationMemberships: {
                where: decoded.organizationId ? { organizationId: decoded.organizationId } : { organizationId: '__missing__' },
                select: { organizationId: true }
            }
        }
    });

    if (!currentUser) {
        throw new AppError('The user belonging to this token does no longer exist.', 401);
    }

    if (!currentUser.isActive) {
        throw new AppError('User is deactivated.', 401);
    }

    if (decoded.tokenVersion !== currentUser.tokenVersion) {
        throw new AppError('Session has been revoked.', 401);
    }

    if (decoded.sessionId) {
        const session = await prisma.authSession.findFirst({
            where: { id: decoded.sessionId, userId: currentUser.id, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, organizationId: true, createdAt: true, lastUsedAt: true },
        });
        if (!session) throw new AppError('Session has been revoked.', 401);
        if (session.organizationId) {
            const policy = await securityPolicyService.get(session.organizationId);
            try { securityPolicyService.assertSessionActive(policy, session, requestIp); }
            catch (error) {
                await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
                throw error;
            }
            if (Date.now() - session.lastUsedAt.getTime() > 5 * 60_000) {
                void prisma.authSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
            }
        }
    }

    let permissions: string[] = [];
    try {
        if (typeof (prisma as any).$queryRaw === 'function') {
            const rows = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT ap.key
                FROM "UserRoleBinding" urb
                JOIN "AccessRole" ar ON ar.id = urb."roleId"
                JOIN "AccessRolePermission" arp ON arp."roleId" = ar.id
                JOIN "AccessPermission" ap ON ap.id = arp."permissionId"
                WHERE urb."userId" = ${currentUser.id}
                  AND ar."organizationId" = ${decoded.organizationId || '__missing__'}
            `;
            permissions = expandPermissionKeys(rows.map((r) => r.key));
        }
    } catch {
        permissions = [];
    }

    // Add context for tenant isolation
    const organizationId = currentUser.organizationMemberships?.[0]?.organizationId || null;
    if ((decoded.organizationId ?? null) !== organizationId) {
        throw new AppError('Organization context has changed. Please log in again.', 401);
    }

    return {
        id: currentUser.id,
        role: currentUser.role,
        permissions,
        organizationId
    };
};

const extractBearerToken = (req: Request): string | undefined => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return req.headers.authorization.split(' ')[1];
    }
    return undefined;
};

const extractCookieToken = (req: Request, cookieName: string): string | undefined => {
    const prefix = `${cookieName}=`;
    return req.headers.cookie?.split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(prefix))
        ?.slice(prefix.length);
};

export const protect = async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req) || extractCookieToken(req, 'nexa_access');

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    try {
        const user = await resolveUserFromToken(token, req.ip || req.socket.remoteAddress);
        if (user.organizationId && user.role !== 'ADMIN') {
            const maintenance = await operationalResilienceService.getMaintenance(user.organizationId);
            if (maintenance.mode) throw new AppError(maintenance.message || 'Planlı bakım çalışması devam ediyor.', 503);
        }
        (req as any).user = user;
        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError('Invalid token. Please log in again.', 401));
    }
};

export const protectAssetAccess = async (req: Request, _res: Response, next: NextFunction) => {
    // Query-string JWTs leak through browser history, logs and referrers. Use
    // the bearer header for API clients or the HttpOnly access cookie for
    // browser image/video requests.
    const token = extractBearerToken(req) || extractCookieToken(req, 'nexa_access');

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    try {
        (req as any).user = await resolveUserFromToken(token, req.ip || req.socket.remoteAddress);
        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError('Invalid token. Please log in again.', 401));
    }
};
