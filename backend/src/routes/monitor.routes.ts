import { Router, type Request, type Response, type NextFunction } from 'express';
import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';

const router = Router();

function isLoopbackAddress(address: string): boolean {
    return (
        address === '127.0.0.1' ||
        address === '::1' ||
        address === '::ffff:127.0.0.1' ||
        address.startsWith('127.')
    );
}

function allowMonitorAccess(req: Request, res: Response, next: NextFunction): void {
    if (process.env.MONITOR_ALLOW_REMOTE === 'true') {
        next();
        return;
    }

    const remoteAddress = req.ip || req.socket.remoteAddress || '';
    const forwarded = req.headers['x-forwarded-for'];

    const forwardedIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim() || ''
        : '';

    if (isLoopbackAddress(remoteAddress) || (forwardedIp && isLoopbackAddress(forwardedIp))) {
        next();
        return;
    }

    res.status(403).json({
        message: 'Monitor endpoints are restricted to localhost. Set MONITOR_ALLOW_REMOTE=true to override.',
    });
}

router.get('/snapshot', allowMonitorAccess, (_req, res) => {
    res.status(200).json(monitoringTelemetryService.getSnapshot());
});

router.get('/stream', allowMonitorAccess, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    const responseWithFlush = res as Response & { flushHeaders?: () => void };
    responseWithFlush.flushHeaders?.();

    monitoringTelemetryService.subscribe(res);

    req.on('close', () => {
        monitoringTelemetryService.unsubscribe(res);
    });
});

export default router;
