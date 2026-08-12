import { z } from 'zod';

export const createAutomationStepSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required'),
        description: z.string().optional(),
        locator: z.string().nullable().optional(),
        actionType: z.string(),
        data: z.string().nullable().optional(),
        pageObject: z.string().trim().min(1).max(120).nullable().optional(),
        projectId: z.string().uuid('Valid project ID required'),
    }).superRefine((data, ctx) => {
        if (['CLICK', 'FILL', 'ASSERT_TEXT', 'ASSERT_VISIBLE', 'SELECT'].includes(data.actionType)) {
            if (!data.locator || data.locator.length < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Locator is required for this action type",
                    path: ["locator"],
                });
            }
        }
        if (['NAVIGATE', 'WAIT', 'SET_COOKIE', 'SET_LOCAL_STORAGE', 'API_REQUEST'].includes(data.actionType)) {
            if (!data.data || data.data.length < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Data (Value/Config) is required for this action type",
                    path: ["data"],
                });
            }
        }
        if (data.actionType === 'API_REQUEST') {
            if (!data.locator || data.locator.length < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "URL (Locator) is required for API Request",
                    path: ["locator"],
                });
            }
        }
    }),
});

export const updateAutomationStepSchema = z.object({
    body: z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        locator: z.string().min(1).nullable().optional(),
        actionType: z.string().optional(),
        data: z.string().nullable().optional(),
        pageObject: z.string().trim().min(1).max(120).nullable().optional(),
    }),
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const getAutomationStepsByProjectSchema = z.object({
    query: z.object({
        projectId: z.string().uuid('Valid project ID required'),
    }),
});

export const automationStepIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const suggestAutomationStepsSchema = z.object({
    body: z.object({
        projectId: z.string().uuid('Valid project ID required'),
        html: z.string().min(1, 'HTML content is required'),
    }),
});
