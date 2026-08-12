import { Request, Response, NextFunction } from 'express';
// import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const sendErrorDev = (err: any, _req: Request, res: Response) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err: any, _req: Request, res: Response) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    } else {
        // Programming or other unknown error: don't leak error details
        // 1) Log error
        logger.error('ERROR 💥', err);

        // 2) Send generic message
        res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!',
        });
    }
};

export const errorMiddleware = (err: any, req: Request, res: Response, _next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'test') {
        logger.error('ERROR:', err.message, err.stack);
    }

    // Log error details for debugging, regardless of environment
    logger.error(err.message, {
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        status: err.status,
        isOperational: err.isOperational,
    });

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else {
        sendErrorProd(err, req, res);
    }
};
