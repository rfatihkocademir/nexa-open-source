import { z } from 'zod';

const dryRunStepSchema = z.object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    action: z.string().optional(),
    expectedResult: z.string().nullable().optional(),
    type: z.string().optional(),
    actionType: z.string().optional(),
    locator: z.string().nullable().optional(),
    data: z.string().nullable().optional(),
}).passthrough().superRefine((step, ctx) => {
    for (const [key, value] of Object.entries(step)) {
        if (typeof value === 'string' && value.length > 10_000) {
            ctx.addIssue({ code: 'too_big', maximum: 10_000, origin: 'string', path: [key], message: 'Step values are too long' });
        }
    }
});

export const createAutomationScenarioSchema = z.object({
    body: z.object({
        testCaseId: z.string().uuid('Valid test case ID required'),
        variables: z.record(z.string(), z.string()).optional(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2_000).optional(),
        steps: z.array(z.object({
            stepId: z.string().uuid(),
            orderIndex: z.number().int().positive(),
        })).optional(),
    }),
});

export const updateAutomationScenarioSchema = z.object({
    body: z.object({
        variables: z.record(z.string(), z.string()).optional(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2_000).nullable().optional(),
    }),
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const automationScenarioIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const getByTestCaseIdSchema = z.object({
    params: z.object({
        testCaseId: z.string().uuid(),
    }),
});

export const dryRunAutomationScenarioSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        steps: z.array(dryRunStepSchema).max(100),
        variables: z.record(z.string().max(100), z.string().max(10_000)).refine((value) => Object.keys(value).length <= 100, 'Too many automation variables').optional(),
        headless: z.boolean().optional(),
    }),
});

export const cleanupAutomationVideoSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        videoUrl: z.string().min(1, 'videoUrl is required'),
    }),
});

export const dryRunIdSchema = z.object({
    params: z.object({
        dryRunId: z.string().uuid(),
    }),
});
