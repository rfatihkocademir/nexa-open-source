import { z } from 'zod';

export const apiExecutionSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        url: z.string().url().max(2048),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        headers: z.record(z.string().max(200), z.string().max(10_000)).refine((value) => Object.keys(value).length <= 50, 'Too many headers').optional(),
        queryParams: z.record(z.string().max(200), z.string().max(2_000)).refine((value) => Object.keys(value).length <= 50, 'Too many query parameters').optional(),
        body: z.unknown().optional(),
        assertions: z.array(z.object({
            type: z.enum(['STATUS_CODE', 'JSON_PATH', 'RESPONSE_TIME', 'HEADER']),
            target: z.string().max(500).optional(),
            operator: z.enum(['EQUALS', 'CONTAINS', 'LESS_THAN', 'GREATER_THAN', 'EXISTS']),
            expectedValue: z.unknown().optional(),
        })).max(20).optional(),
    }),
});

export const apiAutomationTextSchema = z.object({
    body: z.object({
        curlCommand: z.string().max(50_000).optional(),
        prompt: z.string().max(20_000).optional(),
    }).passthrough(),
});
