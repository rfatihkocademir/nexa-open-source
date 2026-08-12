import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const requestTraceStorage = new AsyncLocalStorage<string>();

export function requestTraceMiddleware(_req: Request, _res: Response, next: NextFunction) {
    requestTraceStorage.run(randomUUID(), next);
}

export function requestTraceId(): string | null {
    return requestTraceStorage.getStore() || null;
}
