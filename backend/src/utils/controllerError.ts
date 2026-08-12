import { Response } from 'express';
import { AppError } from './AppError';

type ErrorLike = {
    statusCode?: number;
    message?: string;
};

const isErrorLike = (error: unknown): error is ErrorLike => {
    return typeof error === 'object' && error !== null;
};

export const respondWithControllerError = (
    res: Response,
    error: unknown,
    fallbackMessage: string = 'Internal server error'
) => {
    // Ensure the error is logged for visibility in terminal
    console.error(`[App] Controller Error:`, error);
    
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
    }

    // Prisma Known Error Code Handling
    if (isErrorLike(error) && (error as any).code?.startsWith?.('P')) {
        const code = (error as any).code;
        if (code === 'P2002') {
            return res.status(409).json({ error: 'Unique constraint violation: Record with this identifier already exists.' });
        }
        if (code === 'P2025') {
            return res.status(404).json({ error: 'Requested record was not found or has been deleted.' });
        }
        if (code === 'P2003') {
            return res.status(400).json({ error: 'Foreign key constraint failed: Linked entity does not exist.' });
        }
    }

    if (isErrorLike(error) && typeof error.statusCode === 'number' && typeof error.message === 'string') {
        return res.status(error.statusCode).json({ error: error.message });
    }

    const message = isErrorLike(error) && typeof error.message === 'string' ? error.message : fallbackMessage;

    return res.status(500).json({ error: message });
};
