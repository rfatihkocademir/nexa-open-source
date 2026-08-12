import { z } from 'zod';

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createPromptTemplateSchema = z.object({
    body: z.object({
        slug,
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional(),
    }),
});

export const addPromptVersionSchema = z.object({
    body: z.object({
        templateBody: z.string().min(1).max(200_000),
        inputSchema: z.unknown().optional(),
        outputSchema: z.unknown().optional(),
        config: z.unknown().optional(),
    }),
});

export const activatePromptVersionSchema = z.object({
    body: z.object({ version: z.number().int().positive() }),
});
