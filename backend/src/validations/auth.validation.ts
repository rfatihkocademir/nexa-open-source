import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(12, 'Password must be at least 12 characters'),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
        mfaCode: z.union([z.string().regex(/^\d{6}$/), z.literal('')]).optional().transform((value) => value || undefined),
        organizationSlug: z.union([z.string().min(1).max(100), z.literal('')]).optional().transform((value) => value || undefined),
    }),
});

export const resetRequestSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const resetPasswordSchema = z.object({ body: z.object({ token: z.string().min(32), password: z.string().min(12) }) });
export const tokenSchema = z.object({ body: z.object({ token: z.string().min(6) }) });

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
