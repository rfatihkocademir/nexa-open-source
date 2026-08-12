type LogMethod = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const write = (method: LogMethod, scope: string, args: unknown[]) => {
    if (!isDevelopment && (method === 'debug' || method === 'info')) {
        return;
    }

    console[method](`[${scope}]`, ...args);
};

export const createLogger = (scope: string) => ({
    debug: (...args: unknown[]) => write('debug', scope, args),
    info: (...args: unknown[]) => write('info', scope, args),
    warn: (...args: unknown[]) => write('warn', scope, args),
    error: (...args: unknown[]) => write('error', scope, args),
});

export const logger = createLogger('Frontend');
