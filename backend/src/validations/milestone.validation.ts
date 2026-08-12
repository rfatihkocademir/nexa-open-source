import { z } from 'zod';

const RunStatus = z.enum(['OPEN', 'COMPLETED', 'ARCHIVED']);

export const createMilestoneSchema = z.object({
    body: z.object({
        name: z.string().min(3, 'Milestone name must be at least 3 characters'),
        description: z.string().optional(),
        dueDate: z.string().datetime().optional(), // Expect ISO date string
        projectId: z.string().uuid('Invalid project ID'),
    }),
});

export const updateMilestoneSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid milestone ID'),
    }),
    body: z.object({
        name: z.string().min(3, 'Milestone name must be at least 3 characters').optional(),
        description: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        status: RunStatus.optional(),
    }),
});

export const milestoneIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid milestone ID'),
    }),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>['body'];
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>['body'];
