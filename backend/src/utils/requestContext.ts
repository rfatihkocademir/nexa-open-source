import { Request } from 'express';
import { AppError } from './AppError';
import { AuditContext } from '../services/audit.service';

export type RequestActor = {
    userId: string;
    role: string;
    organizationId: string;
};

export type AuthorizedProjectActor = RequestActor & {
    projectId: string;
};

export const getRequestActor = (req: Request): RequestActor => {
    if (!req.user?.id || !req.user?.role) {
        throw new AppError('Authentication required', 401);
    }
    if (!req.user.organizationId) throw new AppError('Organization context is required', 403);

    return {
        userId: req.user.id,
        role: req.user.role,
        organizationId: req.user.organizationId,
    };
};

export const getAuthorizedProjectId = (req: Request, ...fallbacks: Array<unknown>): string => {
    if (req.projectAccessContext?.projectId) {
        return req.projectAccessContext.projectId;
    }

    for (const fallback of fallbacks) {
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
            return fallback.trim();
        }
    }

    throw new AppError('projectId is required', 400);
};

export const getAuthorizedProjectActor = (req: Request, ...fallbacks: Array<unknown>): AuthorizedProjectActor => {
    const { userId, role, organizationId } = getRequestActor(req);
    const projectId = getAuthorizedProjectId(req, ...fallbacks);

    return {
        userId,
        role,
        organizationId,
        projectId,
    };
};

/**
 * Extracts audit context (actor, IP, userAgent) from the request.
 * Used by AuditService for rich audit logging.
 */
export const getAuditContext = (req: Request, projectId?: string): AuditContext => {
    const { userId } = getRequestActor(req);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || undefined;

    const userAgent = req.headers['user-agent'] || undefined;

    return {
        actorId: userId,
        organizationId: req.user?.organizationId || undefined,
        projectId,
        ip,
        userAgent,
    };
};
