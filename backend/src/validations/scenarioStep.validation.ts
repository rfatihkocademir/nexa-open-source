import { z } from 'zod';

export const addStepToScenarioSchema = z.object({
    body: z.object({
        scenarioId: z.string().uuid('Valid scenario ID required'),
        stepId: z.string().uuid('Valid step ID required'),
        orderIndex: z.number().int().min(0, 'Order index must be non-negative'),
    }),
});

export const removeStepFromScenarioSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const reorderStepsSchema = z.object({
    body: z.object({
        scenarioId: z.string().uuid('Valid scenario ID required'),
        steps: z.array(
            z.object({
                id: z.string().uuid(),
                orderIndex: z.number().int().min(0),
            })
        ),
    }),
});

export const getScenarioStepsSchema = z.object({
    params: z.object({
        scenarioId: z.string().uuid(),
    }),
});
