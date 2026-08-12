import { z } from 'zod';

export const generateStoriesSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        description: z.string().min(1, 'Description is required'),
        context: z.string().optional(),
        language: z.string().optional(),
    }),
});

export const generateStepsSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        title: z.string().min(1, 'Title is required'),
        context: z.string().optional(),
        language: z.string().optional(),
    }),
});
