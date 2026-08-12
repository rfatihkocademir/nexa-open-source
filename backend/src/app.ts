import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
// import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { errorMiddleware } from './middlewares/error.middleware';
import { monitoringMiddleware } from './middlewares/monitoring.middleware';
import { morganMiddleware } from './utils/morganMiddleware';
import { createLogger } from './utils/logger';
import { operationalResilienceService } from './services/operational-resilience.service';
import { securityAuditMiddleware } from './middlewares/securityAudit.middleware';
import { AppError } from './utils/AppError';
import { requestTraceMiddleware } from './utils/requestTrace';

const app = express();
const logger = createLogger('App');

const configuredTrustProxy = process.env.TRUST_PROXY?.trim();
if (configuredTrustProxy && configuredTrustProxy !== 'false') {
    const trustProxy = /^\d+$/.test(configuredTrustProxy)
        ? Number(configuredTrustProxy)
        : configuredTrustProxy === 'true'
            ? true
            : configuredTrustProxy;
    app.set('trust proxy', trustProxy);
}

const defaultAllowedOrigins = [
    'http://localhost',
    'http://localhost:80',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:4010',
    'http://localhost:4011',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
    'http://127.0.0.1:5177',
    'http://127.0.0.1:4010',
    'http://127.0.0.1:4011',
];

const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.ALLOWED_ORIGINS,
]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    ...(process.env.NODE_ENV === 'production' ? [] : defaultAllowedOrigins),
    ...configuredOrigins,
]);

function isAllowedOrigin(origin?: string | null): boolean {
    if (!origin) {
        return true;
    }

    if (allowedOrigins.has(origin)) {
        return true;
    }

    return process.env.NODE_ENV !== 'production'
        && /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)$/i.test(origin);
}

// Trace ID / Correlation ID Middleware
// Must be one of the first middlewares to track all subsequent logs
app.use(requestTraceMiddleware);

// Middlewares
// Security Headers
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 1000,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
});
app.use('/api', limiter);

// Prevent Parameter Pollution
app.use(hpp());

// CORS
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new AppError(`CORS origin not allowed: ${origin}`, 403));
    },
    credentials: true,
}));

app.use(compression());
app.use(express.json({
    limit: '5mb',
    type: ['application/json', 'application/*+json'],
    verify: (req, _res, buf) => {
        const request = req as typeof req & { originalUrl?: string; rawBody?: Buffer };
        if (request.originalUrl?.startsWith('/api/v1/webhooks/git/github')) {
            request.rawBody = Buffer.from(buf);
        }
    },
})); // Body limit
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morganMiddleware); // Use custom winston morgan middleware
app.use(monitoringMiddleware);
app.use(securityAuditMiddleware);
app.use('/public', express.static('public'));

import routes from './routes';

// Routes
logger.debug('Registering routes...');
app.use('/api/v1', routes);

app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

app.get(['/health', '/health/ready'], async (_req, res) => {
    const result = await operationalResilienceService.infrastructureReadiness();
    res.status(result.ready ? 200 : 503).json(result);
});

// Error Handling
app.use(errorMiddleware);

export default app;
