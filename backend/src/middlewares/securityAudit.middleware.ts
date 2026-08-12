import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';

export function securityAuditMiddleware(req: Request, res: Response, next: NextFunction) {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const startedAt = Date.now();
    res.on('finish', () => {
        const isAccessDenial = res.statusCode === 401 || res.statusCode === 403;
        const isRateLimited = res.statusCode === 429;
        if (!isMutation && !isAccessDenial && !isRateLimited) return;
        const path = req.originalUrl.split('?')[0];
        const action = isAccessDenial
            ? 'SECURITY_UNAUTHORIZED_ACCESS'
            : isRateLimited
                ? 'SECURITY_RATE_LIMIT_TRIGGERED'
                : `${req.method}_${res.statusCode < 400 ? 'SUCCEEDED' : 'FAILED'}`;
        auditService.log({
            context: {
                actorId: req.user?.id || 'system',
                organizationId: req.user?.organizationId || undefined,
                projectId: req.projectAccessContext?.projectId,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            },
            entityType: isAccessDenial || isRateLimited ? 'Security' : 'HttpMutation',
            entityId: path,
            action,
            after: { statusCode: res.statusCode, method: req.method, path, durationMs: Date.now() - startedAt },
        }).catch(() => undefined);
    });
    return next();
}
