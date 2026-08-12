import { z } from 'zod';

export const createTestRunSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters'),
        projectId: z.string().uuid('Invalid project ID').optional(),
        milestoneId: z.string().uuid('Invalid milestone ID').optional(),
        description: z.string().optional(),
        environment: z.enum(['DEV', 'QA', 'PREPROD', 'PROD']).optional(),
        startDate: z.string().datetime().optional(),
        dueDate: z.string().datetime().optional(),
        includeAllCases: z.boolean().optional(),
        testCaseIds: z.array(z.string().uuid()).optional(),
    }).refine(data => {
        if (data.includeAllCases) return !!data.projectId;
        return true;
    }, {
        message: "Project ID is required when 'includeAllCases' is true",
        path: ["projectId"]
    }),
});

export const testRunIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid test run ID'),
    }),
});

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>['body'];
