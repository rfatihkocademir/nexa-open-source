import { z } from 'zod';

const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const CaseStatus = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REVISE']);

const StepSchema = z.object({
    action: z.string().min(1, 'Action is required'),
    expected: z.string().min(1, 'Expected result is required'),
    expectedResult: z.string().optional(),
    type: z.enum(['MANUAL', 'WEB', 'MOBILE']).optional(),
    actionType: z.string().optional(),
    locator: z.string().optional(),
    data: z.string().optional(),
    order: z.number().optional(),
});

export const createTestCaseSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters'),
        description: z.string().optional(),
        preconditions: z.string().optional(),
        steps: z.array(StepSchema),
        priority: Priority.optional(),
        suiteId: z.string().uuid('Invalid suite ID').optional(),
        projectId: z.string().uuid('Invalid project ID').optional(),
    }).refine((body) => body.suiteId || body.projectId, { message: 'Suite or project is required' }),
});

export const updateTestCaseSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid test case ID'),
    }),
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters').optional(),
        description: z.string().optional(),
        preconditions: z.string().optional(),
        steps: z.array(StepSchema).optional(),
        priority: Priority.optional(),
        status: CaseStatus.optional(),
        suiteId: z.string().uuid('Invalid suite ID').optional(),
    }),
});

export const testCaseIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid test case ID'),
    }),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>['body'];
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>['body'];
