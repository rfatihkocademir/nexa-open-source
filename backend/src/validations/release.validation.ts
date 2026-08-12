import { z } from 'zod';

const uuidParam = z.string().uuid('Invalid UUID');

export const createReleaseCandidateSchema = z.object({
    params: z.object({
        projectId: uuidParam,
    }),
    body: z.object({
        title: z.string().min(3, 'title must be at least 3 characters'),
        summary: z.string().optional(),
        label: z.string().optional(),
        sprintId: z.string().uuid().optional(),
        milestoneId: z.string().uuid().optional(),
        sourceRequestId: z.string().uuid().optional(),
        testRunIds: z.array(z.string().uuid()).optional(),
        workItemIds: z.array(z.string().uuid()).optional(),
    }),
});

export const releaseCandidateIdSchema = z.object({
    params: z.object({
        projectId: uuidParam,
        id: uuidParam,
    }),
});

export const createDecisionRecordSchema = z.object({
    params: z.object({
        projectId: uuidParam,
        id: uuidParam,
    }),
    body: z.object({
        type: z.enum(['SCOPE', 'DELIVERY', 'QUALITY', 'RELEASE', 'RISK']),
        outcome: z.enum(['APPROVED', 'REJECTED', 'CONDITIONAL', 'NEEDS_MORE_INFO']),
        rationale: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
    }),
});

export const createReleaseFollowUpSchema = z.object({
    params: z.object({
        projectId: uuidParam,
        id: uuidParam,
    }),
    body: z.object({
        itemType: z.enum(['BUG', 'STORY', 'TASK']),
        title: z.string().min(3, 'title must be at least 3 characters'),
        description: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        sourceActionType: z.enum(['BUG', 'RUN', 'COVERAGE', 'TRACEABILITY', 'DECISION']),
        sourceActionFocus: z.enum(['critical-bugs', 'failed-runs', 'open-runs', 'conflicts', 'traceability-gaps', 'coverage-gaps', 'follow-up-items']),
    }),
});

export type CreateReleaseCandidateInput = z.infer<typeof createReleaseCandidateSchema>['body'];
export type CreateDecisionRecordInput = z.infer<typeof createDecisionRecordSchema>['body'];
export type CreateReleaseFollowUpInput = z.infer<typeof createReleaseFollowUpSchema>['body'];
