import { z } from 'zod';

export const createProjectSchema = z.object({
    body: z.object({
        name: z.string().min(3, 'Project name must be at least 3 characters'),
        description: z.string().optional(),
        scope: z.string().optional(),
        architecture: z.string().optional(),
        memberIds: z.array(z.string().uuid()).optional(),
        primaryTeamId: z.string().uuid().optional(),
        documentationSuite: z.object({
            scope: z.string().optional(),
            architecture: z.string().optional(),
            testStrategy: z.string().optional(),
            automationStrategy: z.string().optional(),
            releasePolicy: z.string().optional()
        }).optional(),
    }),
});


export const updateProjectSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid project ID'),
    }),
    body: z.object({
        name: z.string().min(3, 'Project name must be at least 3 characters').optional(),
        description: z.string().optional(),
        primaryTeamId: z.string().uuid().nullable().optional(),
    }),
});

export const projectIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid project ID'),
    }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
