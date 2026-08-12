import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';
type ConsoleMethod = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|password|secret|token|accessToken|refreshToken|clientSecret|code|state)$/i;

const redactString = (value: string): string => value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:code|state|token|access_token|refresh_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/("?(?:password|secret|token|authorization|cookie)"?\s*[:=]\s*"?)[^",\s}]+/gi, '$1[REDACTED]');

const redact = (input: unknown, seen = new WeakSet<object>()): unknown => {
    if (typeof input === 'string') return redactString(input);
    if (input instanceof Error) {
        const sanitized = new Error(redactString(input.message));
        sanitized.name = input.name;
        sanitized.stack = input.stack ? redactString(input.stack) : undefined;
        return sanitized;
    }
    if (!input || typeof input !== 'object') return input;
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.map((item) => redact(item, seen));
    return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(value, seen),
    ]));
};

const stringifyArg = (input: unknown): string => {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof Error) {
        return input.stack || input.message;
    }
    try {
        return JSON.stringify(input);
    } catch {
        return String(input);
    }
};

const emit = (method: ConsoleMethod, scope: string, args: unknown[]) => {
    const safeArgs = args.map((arg) => redact(arg));
    console[method](`[${scope}]`, ...safeArgs);
    monitoringTelemetryService.recordAppLog({
        level: method,
        scope,
        message: safeArgs.map(stringifyArg).join(' '),
    });
};

export const createLogger = (scope: string) => ({
    info: (...args: unknown[]) => emit('info', scope, args),
    warn: (...args: unknown[]) => emit('warn', scope, args),
    error: (...args: unknown[]) => emit('error', scope, args),
    debug: (...args: unknown[]) => emit('debug', scope, args),
    http: (...args: unknown[]) => emit('info', scope, args),
});

export const logger = createLogger('App');
