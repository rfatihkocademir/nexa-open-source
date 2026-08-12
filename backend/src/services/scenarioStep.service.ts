import { randomUUID } from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import {
    hydrateScenarioSteps,
    parseScenarioFromScript,
    serializeScenario,
    StoredAutomationScenario,
} from './automationStorage.service';

interface AddStepDTO {
    scenarioId: string;
    stepId: string;
    orderIndex: number;
}

interface ReorderStepsDTO {
    scenarioId: string;
    steps: Array<{ id: string; orderIndex: number }>;
}

interface ScenarioContext {
    testCaseId: string;
    projectId: string;
    automationScript: string | null;
    scenario: StoredAutomationScenario;
    isNormalized: boolean;
    automationScenarioId?: string;
}


export class ScenarioStepService {
    private async getScenarioContext(scenarioId: string, userId: string, role: string): Promise<ScenarioContext> {
        // Try finding as AutomationScenario (New System)
        const automationScenario = await prisma.automationScenario.findUnique({
            where: { id: scenarioId },
            include: { 
                steps: { 
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                },
                testCase: {
                    select: {
                        id: true,
                        title: true,
                        suite: { select: { projectId: true } }
                    }
                }
            }
        });

        if (automationScenario) {
            await ProjectAccess.check(automationScenario.projectId, userId, role);

            const storedScenario: StoredAutomationScenario = {
                id: automationScenario.id,
                testCaseId: automationScenario.testCaseId,
                variables: (automationScenario.variables as Record<string, string>) || {},
                steps: automationScenario.steps.map(s => ({
                    id: s.id,
                    stepId: s.testStepId,
                    orderIndex: s.orderIndex
                })),
                createdAt: automationScenario.createdAt.toISOString(),
                updatedAt: automationScenario.updatedAt.toISOString()
            };

            return {
                testCaseId: automationScenario.testCaseId,
                projectId: automationScenario.projectId,
                automationScript: null,
                scenario: storedScenario,
                isNormalized: true,
                automationScenarioId: automationScenario.id
            };
        }

        // Fallback: Try finding as TestCase (Old System)
        const testCase = await prisma.testCase.findUnique({
            where: { id: scenarioId },
            select: {
                id: true,
                automationScript: true,
                suite: {
                    select: {
                        projectId: true,
                    },
                },
            },
        });

        if (!testCase) {
            throw new AppError('Automation scenario not found', 404);
        }

        await ProjectAccess.check(testCase.suite.projectId, userId, role);

        const scenario = parseScenarioFromScript(testCase.automationScript, testCase.id);
        if (!scenario) {
            throw new AppError('Automation scenario not found', 404);
        }

        return {
            testCaseId: testCase.id,
            projectId: testCase.suite.projectId,
            automationScript: testCase.automationScript,
            scenario,
            isNormalized: false
        };
    }


    async addStep(dto: AddStepDTO, userId: string, role: string) {
        const context = await this.getScenarioContext(dto.scenarioId, userId, role);

        const step = await prisma.testStep.findFirst({
            where: {
                id: dto.stepId,
                projectId: context.projectId,
            },
        });

        if (!step) {
            throw new AppError('Automation step not found', 404);
        }

        const requestedOrderIndex = Number.isFinite(dto.orderIndex) ? dto.orderIndex : context.scenario.steps.length + 1;
        const targetOrderIndex = Math.min(
            Math.max(Math.floor(requestedOrderIndex), 1),
            context.scenario.steps.length + 1,
        );
        
        // Handle shifting steps
        if (context.isNormalized && context.automationScenarioId) {
            // New System: Update DB tables
            await prisma.$transaction(async (tx) => {
                // Shift existing steps
                await tx.automationScenarioStep.updateMany({
                    where: {
                        scenarioId: context.automationScenarioId,
                        orderIndex: { gte: targetOrderIndex }
                    },
                    data: {
                        orderIndex: { increment: 1 }
                    }
                });

                // Create new step
                await tx.automationScenarioStep.create({
                    data: {
                        scenarioId: context.automationScenarioId!,
                        testStepId: dto.stepId,
                        orderIndex: targetOrderIndex
                    }
                });
                await tx.automationScenario.update({
                    where: { id: context.automationScenarioId! },
                    data: { status: 'DRAFT', updatedAt: new Date() },
                });
            });

            // Return hydrated result
            const refreshedScenario = await prisma.automationScenario.findUnique({
                where: { id: context.automationScenarioId },
                include: { steps: { include: { testStep: true }, orderBy: { orderIndex: 'asc' } } }
            });

            const hydrated = await hydrateScenarioSteps({
                ...context.scenario,
                steps: refreshedScenario!.steps.map(s => ({ id: s.id, stepId: s.testStepId, orderIndex: s.orderIndex }))
            }, context.projectId);

            return hydrated.find(h => h.stepId === dto.stepId && h.orderIndex === targetOrderIndex);
        } else {
            // Old System: Update JSON script
            const shiftedSteps = context.scenario.steps.map((scenarioStep) => {
                if (scenarioStep.orderIndex >= targetOrderIndex) {
                    return { ...scenarioStep, orderIndex: scenarioStep.orderIndex + 1 };
                }
                return scenarioStep;
            });

            const newStep = {
                id: randomUUID(),
                stepId: dto.stepId,
                orderIndex: targetOrderIndex,
            };

            const updatedScenario = {
                ...context.scenario,
                steps: [...shiftedSteps, newStep].sort((a, b) => a.orderIndex - b.orderIndex),
                updatedAt: new Date().toISOString(),
            };

            await prisma.testCase.update({
                where: { id: context.testCaseId },
                data: {
                    automationScript: serializeScenario(updatedScenario),
                },
            });

            const hydrated = await hydrateScenarioSteps(updatedScenario, context.projectId);
            return hydrated.find((item) => item.id === newStep.id);
        }
    }


    async getScenarioSteps(scenarioId: string, userId: string, role: string) {
        const context = await this.getScenarioContext(scenarioId, userId, role);
        return hydrateScenarioSteps(context.scenario, context.projectId);
    }

    async removeStep(id: string, userId: string, role: string) {
        // Try New System First
        const normalizedStep = await prisma.automationScenarioStep.findUnique({
            where: { id },
            include: { scenario: true }
        });

        if (normalizedStep) {
            await ProjectAccess.check(normalizedStep.scenario.projectId, userId, role);

            await prisma.$transaction(async (tx) => {
                const scenarioId = normalizedStep.scenarioId;
                const removedOrder = normalizedStep.orderIndex;

                await tx.automationScenarioStep.delete({ where: { id } });

                // Re-balance order indices
                await tx.automationScenarioStep.updateMany({
                    where: {
                        scenarioId,
                        orderIndex: { gt: removedOrder }
                    },
                    data: {
                        orderIndex: { decrement: 1 }
                    }
                });
                
                await tx.automationScenario.update({
                    where: { id: scenarioId },
                    data: { status: 'DRAFT', updatedAt: new Date() }
                });
            });
            return;
        }

        // Fallback to Old System (Iterative Search)
        const candidates = await prisma.testCase.findMany({
            where: {
                automationScript: { not: null },
            },
            select: {
                id: true,
                automationScript: true,
                suite: {
                    select: {
                        projectId: true,
                    },
                },
            },
        });

        for (const testCase of candidates) {
            const scenario = parseScenarioFromScript(testCase.automationScript, testCase.id);
            if (!scenario) continue;

            const index = scenario.steps.findIndex((scenarioStep) => scenarioStep.id === id);
            if (index === -1) continue;

            await ProjectAccess.check(testCase.suite.projectId, userId, role);

            scenario.steps.splice(index, 1);
            scenario.steps = scenario.steps
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((step, order) => ({ ...step, orderIndex: order + 1 }));
            scenario.updatedAt = new Date().toISOString();

            await prisma.testCase.update({
                where: { id: testCase.id },
                data: {
                    automationScript: serializeScenario(scenario),
                },
            });
            return;
        }

        throw new AppError('Scenario step not found', 404);
    }


    async reorderSteps(dto: ReorderStepsDTO, userId: string, role: string) {
        const context = await this.getScenarioContext(dto.scenarioId, userId, role);

        if (context.isNormalized && context.automationScenarioId) {
            // New System Reorder
            const ids = dto.steps.map((step) => step.id);
            if (new Set(ids).size !== ids.length) {
                throw new AppError('Duplicate scenario steps are not allowed', 400);
            }

            await prisma.$transaction(async (tx) => {
                const scopedSteps = await tx.automationScenarioStep.findMany({
                    where: {
                        id: { in: ids },
                        scenarioId: context.automationScenarioId,
                    },
                    select: { id: true },
                });

                if (scopedSteps.length !== ids.length) {
                    throw new AppError('One or more scenario steps do not belong to this scenario', 400);
                }

                const currentSteps = await tx.automationScenarioStep.findMany({
                    where: { scenarioId: context.automationScenarioId },
                    select: { id: true },
                });
                if (currentSteps.length !== ids.length || currentSteps.some((step) => !ids.includes(step.id))) {
                    throw new AppError('Reorder payload must contain every step in the scenario exactly once', 400);
                }

                // Use a temporary negative range so a future unique order
                // constraint cannot be violated while two rows swap places.
                for (const [index, step] of dto.steps.entries()) {
                    await tx.automationScenarioStep.update({
                        where: { id: step.id },
                        data: { orderIndex: -(index + 1) },
                    });
                }
                for (const [index, step] of dto.steps.entries()) {
                    await tx.automationScenarioStep.update({
                        where: { id: step.id },
                        data: { orderIndex: index + 1 },
                    });
                }
                await tx.automationScenario.update({
                    where: { id: context.automationScenarioId! },
                    data: { status: 'DRAFT', updatedAt: new Date() },
                });
            });

            const refreshed = await prisma.automationScenario.findUnique({
                where: { id: context.automationScenarioId },
                include: { steps: { include: { testStep: true }, orderBy: { orderIndex: 'asc' } } }
            });

            return hydrateScenarioSteps({
                ...context.scenario,
                steps: refreshed!.steps.map(s => ({ id: s.id, stepId: s.testStepId, orderIndex: s.orderIndex }))
            }, context.projectId);
        }

        // Old System Reorder
        const orderMap = new Map(dto.steps.map((step) => [step.id, step.orderIndex]));

        const unknownStep = dto.steps.find(
            (step) => !context.scenario.steps.some((scenarioStep) => scenarioStep.id === step.id)
        );
        if (unknownStep) {
            throw new AppError(`Scenario step ${unknownStep.id} not found in scenario`, 400);
        }
        if (dto.steps.length !== context.scenario.steps.length || new Set(dto.steps.map((step) => step.id)).size !== context.scenario.steps.length) {
            throw new AppError('Reorder payload must contain every step in the scenario exactly once', 400);
        }

        const reordered = [...context.scenario.steps]
            .sort((a, b) => (orderMap.get(a.id) ?? a.orderIndex) - (orderMap.get(b.id) ?? b.orderIndex))
            .map((step, index) => ({ ...step, orderIndex: index + 1 }));

        const updatedScenario = {
            ...context.scenario,
            steps: reordered,
            updatedAt: new Date().toISOString(),
        };

        await prisma.testCase.update({
            where: { id: context.testCaseId },
            data: {
                automationScript: serializeScenario(updatedScenario),
            },
        });

        return hydrateScenarioSteps(updatedScenario, context.projectId);
    }

}

export const scenarioStepService = new ScenarioStepService();
