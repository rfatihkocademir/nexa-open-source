import { z } from 'zod';

const ResultStatus = z.enum(['PASS', 'FAIL', 'RETEST', 'BLOCK', 'UNTESTED']);

export const addResultSchema = z.object({
    params: z.object({
        runItemId: z.string().uuid('Invalid run item ID'),
    }),
    body: z.object({
        status: ResultStatus,
        duration: z.number().int().min(0).optional(), // in ms
        comment: z.string().optional(),
        stepResults: z.array(z.object({
            stepIndex: z.number().int().min(0),
            status: ResultStatus,
            comment: z.string().optional()
        })).optional(),
        evidenceUrl: z.string().url().optional(),
        attachmentIds: z.array(z.string().uuid()).optional(),
    }),
});

export const addAutomationResultSchema = z.object({
    params: z.object({
        runItemId: z.string().uuid('Invalid run item ID'),
    }),
    body: z.object({
        status: ResultStatus,
        duration: z.number().int().min(0).optional(),
        errorOutput: z.string().optional(),
        videoUrl: z.string().url().optional(),
    }),
});

export type AddResultInput = z.infer<typeof addResultSchema>['body'];
export type AddAutomationResultInput = z.infer<typeof addAutomationResultSchema>['body'];
