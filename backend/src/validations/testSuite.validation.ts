import { z } from 'zod';

export const createSuiteSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Suite name is required'),
        projectId: z.string().uuid('Invalid project ID'),
        parentId: z.string().uuid('Invalid parent suite ID').optional(),
    }),
});

export const updateSuiteSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid suite ID'),
    }),
    body: z.object({
        name: z.string().min(1, 'Suite name is required').optional(),
        parentId: z.string().uuid('Invalid parent suite ID').optional().nullable(),
    }),
});

export const suiteIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid suite ID'),
    }),
});

export type CreateSuiteInput = z.infer<typeof createSuiteSchema>['body'];
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>['body'];
