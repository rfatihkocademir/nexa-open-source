import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const validate = (schema: ZodSchema) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const messages = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
            next(new AppError(`Validation Error: ${messages}`, 400));
        } else {
            next(error);
        }
    }
};
