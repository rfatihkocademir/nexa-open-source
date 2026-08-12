import type { Response } from 'express';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type QueueEventType = 'queued' | 'active' | 'completed' | 'failed' | 'enqueue_failed';

const HTTP_EVENT_LIMIT = 400;
const QUEUE_EVENT_LIMIT = 400;
const APP_LOG_EVENT_LIMIT = 500;
const HEARTBEAT_INTERVAL_MS = 15000;

export interface HttpTelemetryEvent {
    id: number;
    timestamp: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    contentLength: number | null;
    ip: string | null;
    userId: string | null;
    requestId: string | null;
    userAgent: string | null;
}

export interface QueueTelemetryEvent {
    id: number;
    timestamp: string;
    queueName: string;
    event: QueueEventType;
    jobId: string | null;
    jobName: string | null;
    attemptsMade: number | null;
    dataPreview: string | null;
    error: string | null;
}

export interface AppLogTelemetryEvent {
    id: number;
    timestamp: string;
    level: LogLevel;
    scope: string;
    message: string;
}

interface QueueStatsSnapshot {
    queueName: string;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    enqueueFailed: number;
    lastEventAt: string | null;
}

interface QueueTotalsSnapshot {
    total: number;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    enqueueFailed: number;
}

interface QueueStatsState extends QueueStatsSnapshot {}

function safeStringify(input: unknown, limit = 220): string | null {
    if (input === undefined || input === null) {
        return null;
    }

    try {
        const raw = JSON.stringify(input);
        if (!raw) {
            return null;
        }
        if (raw.length <= limit) {
            return raw;
        }
        return `${raw.slice(0, limit)}…`;
    } catch {
        return '[unserializable]';
    }
}

function clampNonNegative(value: number): number {
    return value < 0 ? 0 : value;
}

function truncateText(input: string, limit = 280): string {
    if (input.length <= limit) {
        return input;
    }
    return `${input.slice(0, limit)}…`;
}

class MonitoringTelemetryService {
    private readonly httpEvents: HttpTelemetryEvent[] = [];
    private readonly queueEvents: QueueTelemetryEvent[] = [];
    private readonly appLogEvents: AppLogTelemetryEvent[] = [];
    private readonly sseClients = new Set<Response>();
    private readonly queueStats = new Map<string, QueueStatsState>();

    private nextHttpId = 1;
    private nextQueueId = 1;
    private nextLogId = 1;

    private readonly httpTotals = {
        total: 0,
        success: 0,
        clientError: 0,
        serverError: 0,
    };

    private readonly queueTotals: QueueTotalsSnapshot = {
        total: 0,
        queued: 0,
        active: 0,
        completed: 0,
        failed: 0,
        enqueueFailed: 0,
    };

    private readonly appLogTotals: Record<LogLevel, number> = {
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
    };

    constructor() {
        setInterval(() => {
            this.broadcastHeartbeat();
        }, HEARTBEAT_INTERVAL_MS).unref();
    }

    recordHttp(event: Omit<HttpTelemetryEvent, 'id' | 'timestamp'>): void {
        const now = new Date();
        const normalized: HttpTelemetryEvent = {
            id: this.nextHttpId++,
            timestamp: now.toISOString(),
            method: event.method.toUpperCase(),
            path: truncateText(event.path, 420),
            statusCode: event.statusCode,
            durationMs: Number(event.durationMs.toFixed(1)),
            contentLength: event.contentLength,
            ip: event.ip,
            userId: event.userId,
            requestId: event.requestId,
            userAgent: event.userAgent ? truncateText(event.userAgent, 160) : null,
        };

        this.httpEvents.push(normalized);
        if (this.httpEvents.length > HTTP_EVENT_LIMIT) {
            this.httpEvents.shift();
        }

        this.httpTotals.total += 1;
        if (normalized.statusCode >= 500) {
            this.httpTotals.serverError += 1;
        } else if (normalized.statusCode >= 400) {
            this.httpTotals.clientError += 1;
        } else {
            this.httpTotals.success += 1;
        }

        this.broadcastSnapshot();
    }

    recordQueue(event: {
        queueName: string;
        event: QueueEventType;
        jobId?: string | number | null;
        jobName?: string | null;
        attemptsMade?: number | null;
        data?: unknown;
        error?: string | null;
    }): void {
        const now = new Date();
        const queueName = truncateText(event.queueName, 80);
        const queueState = this.getOrCreateQueueState(queueName);

        if (event.event === 'queued') {
            queueState.queued += 1;
            this.queueTotals.queued += 1;
        } else if (event.event === 'active') {
            queueState.queued = clampNonNegative(queueState.queued - 1);
            queueState.active += 1;
            this.queueTotals.active += 1;
            this.queueTotals.queued = clampNonNegative(this.queueTotals.queued - 1);
        } else if (event.event === 'completed') {
            queueState.active = clampNonNegative(queueState.active - 1);
            queueState.completed += 1;
            this.queueTotals.completed += 1;
            this.queueTotals.active = clampNonNegative(this.queueTotals.active - 1);
        } else if (event.event === 'failed') {
            queueState.active = clampNonNegative(queueState.active - 1);
            queueState.failed += 1;
            this.queueTotals.failed += 1;
            this.queueTotals.active = clampNonNegative(this.queueTotals.active - 1);
        } else if (event.event === 'enqueue_failed') {
            queueState.enqueueFailed += 1;
            this.queueTotals.enqueueFailed += 1;
        }

        queueState.lastEventAt = now.toISOString();
        this.queueTotals.total += 1;

        const normalized: QueueTelemetryEvent = {
            id: this.nextQueueId++,
            timestamp: now.toISOString(),
            queueName,
            event: event.event,
            jobId: event.jobId === undefined || event.jobId === null ? null : String(event.jobId),
            jobName: event.jobName ?? null,
            attemptsMade: event.attemptsMade ?? null,
            dataPreview: safeStringify(event.data),
            error: event.error ? truncateText(event.error, 240) : null,
        };

        this.queueEvents.push(normalized);
        if (this.queueEvents.length > QUEUE_EVENT_LIMIT) {
            this.queueEvents.shift();
        }

        this.broadcastSnapshot();
    }

    recordAppLog(log: { level: LogLevel; scope: string; message: string }): void {
        const normalized: AppLogTelemetryEvent = {
            id: this.nextLogId++,
            timestamp: new Date().toISOString(),
            level: log.level,
            scope: truncateText(log.scope, 60),
            message: truncateText(log.message, 500),
        };

        this.appLogEvents.push(normalized);
        if (this.appLogEvents.length > APP_LOG_EVENT_LIMIT) {
            this.appLogEvents.shift();
        }

        this.appLogTotals[log.level] += 1;
        this.broadcastSnapshot();
    }

    subscribe(res: Response): void {
        this.sseClients.add(res);
        this.sendSnapshot(res);
    }

    unsubscribe(res: Response): void {
        this.sseClients.delete(res);
    }

    getSnapshot() {
        const now = Date.now();
        const oneMinuteAgo = now - 60_000;
        const requestsPerMinute = this.httpEvents.filter((entry) => Date.parse(entry.timestamp) >= oneMinuteAgo).length;
        const queueEventsPerMinute = this.queueEvents.filter((entry) => Date.parse(entry.timestamp) >= oneMinuteAgo).length;

        return {
            generatedAt: new Date(now).toISOString(),
            stream: {
                clientCount: this.sseClients.size,
            },
            http: {
                totals: { ...this.httpTotals },
                requestsPerMinute,
                recent: this.httpEvents.slice(-250),
            },
            queue: {
                totals: { ...this.queueTotals },
                eventsPerMinute: queueEventsPerMinute,
                stats: this.getQueueStatsSnapshot(),
                recent: this.queueEvents.slice(-250),
            },
            appLogs: {
                totals: { ...this.appLogTotals },
                recent: this.appLogEvents.slice(-300),
            },
        };
    }

    private getOrCreateQueueState(queueName: string): QueueStatsState {
        let state = this.queueStats.get(queueName);
        if (!state) {
            state = {
                queueName,
                queued: 0,
                active: 0,
                completed: 0,
                failed: 0,
                enqueueFailed: 0,
                lastEventAt: null,
            };
            this.queueStats.set(queueName, state);
        }
        return state;
    }

    private getQueueStatsSnapshot(): QueueStatsSnapshot[] {
        return [...this.queueStats.values()]
            .map((state) => ({ ...state }))
            .sort((a, b) => a.queueName.localeCompare(b.queueName));
    }

    private broadcastSnapshot(): void {
        if (this.sseClients.size === 0) {
            // Check if there are any socket clients in the monitoring room before skipping
            // Actually, we should check if SocketService is initialized
            try {
                const { SocketService } = require('./socket.service');
                const io = SocketService.getInstance().getIO();
                const monitoringClients = io.sockets.adapter.rooms.get('monitoring');
                if (!monitoringClients || monitoringClients.size === 0) {
                    return;
                }
            } catch {
                return;
            }
        }

        const snapshot = this.getSnapshot();
        const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
        
        // 1. Broadcast to SSE clients
        for (const client of [...this.sseClients]) {
            try {
                client.write(payload);
            } catch {
                this.sseClients.delete(client);
            }
        }

        // 2. Broadcast to Socket.io clients in monitoring room
        try {
            const { SocketService } = require('./socket.service');
            SocketService.getInstance().getIO().to('monitoring').emit('telemetry_snapshot', snapshot);
        } catch {
            // SocketService might not be initialized yet
        }
    }

    private sendSnapshot(res: Response): void {
        try {
            res.write(`event: snapshot\ndata: ${JSON.stringify(this.getSnapshot())}\n\n`);
        } catch {
            this.sseClients.delete(res);
        }
    }

    private broadcastHeartbeat(): void {
        if (this.sseClients.size === 0) {
            return;
        }

        const payload = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`;
        for (const client of [...this.sseClients]) {
            try {
                client.write(payload);
            } catch {
                this.sseClients.delete(client);
            }
        }
    }
}

export const monitoringTelemetryService = new MonitoringTelemetryService();
