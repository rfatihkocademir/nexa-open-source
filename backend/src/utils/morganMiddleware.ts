import morgan, { StreamOptions } from 'morgan';
import { logger } from './logger';

// Override the stream method to tell Morgan to use our custom logger
const stream: StreamOptions = {
    // Use the http severity
    write: (message) => logger.http(message.trim()),
};

// Skip all the Morgan http log if the application is not running in development mode,
// or if it's a noisy polling endpoint.
const skip = (req: any) => {
    const env = process.env.NODE_ENV || 'development';
    if (env !== 'development') return true;
    
    // Skip logging for noisy polling endpoints
    if (req.method === 'GET' && req.originalUrl?.includes('/dry-run/')) {
        return true;
    }
    
    return false;
};

// Build the morgan middleware
export const morganMiddleware = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream, skip }
);
