import type { NextFunction, Request, Response } from 'express';
import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';
import { requestTraceId } from '../utils/requestTrace';
import { operationalResilienceService } from '../services/operational-resilience.service';

const MONITOR_PATH_PREFIX = '/api/v1/monitor';
const IGNORED_PATHS = new Set(['/health', '/test']);

function shouldSkipTelemetry(path: string): boolean {
    if (path.startsWith(MONITOR_PATH_PREFIX)) {
        return true;
    }
    return IGNORED_PATHS.has(path);
}

function resolveClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0]?.trim() || null;
    }

    return req.ip || req.socket.remoteAddress || null;
}

function resolveContentLength(res: Response): number | null {
    const raw = res.getHeader('content-length');
    if (typeof raw === 'number') {
        return raw;
    }
    if (typeof raw === 'string') {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    const path = req.originalUrl || req.url;
    const traceId = requestTraceId();

    if (shouldSkipTelemetry(req.path)) {
        return next();
    }

    res.on('finish', () => {
        const ended = process.hrtime.bigint();
        const durationMs = Number(ended - started) / 1_000_000;

        monitoringTelemetryService.recordHttp({
            method: req.method,
            path,
            statusCode: res.statusCode,
            durationMs,
            contentLength: resolveContentLength(res),
            ip: resolveClientIp(req),
            userId: req.user?.id ?? null,
            requestId: traceId,
            userAgent: req.get('user-agent') || null,
        });
        if (req.user?.organizationId) {
            operationalResilienceService.record(req.user.organizationId, res.statusCode, durationMs);
        }
    });

    return next();
};
