import { randomUUID } from 'crypto';
import { TestStep } from '@prisma/client';
import prisma from '../utils/prisma';

export const AUTOMATION_ACTION_TYPES = [
    'NAVIGATE',
    'CLICK',
    'FILL',
    'ASSERT_TEXT',
    'ASSERT_VISIBLE',
    'WAIT',
    'SELECT',
    'SET_COOKIE',
    'SET_LOCAL_STORAGE',
    'API_REQUEST',
] as const;

export type AutomationActionType = typeof AUTOMATION_ACTION_TYPES[number];

export interface AutomationStepPayload {
    id: string;
    name: string;
    description?: string;
    locator: string;
    actionType: AutomationActionType;
    data?: string;
    projectId: string;
    pageObject?: string;
    _count?: {
        scenarioSteps: number;
    };
}

export interface StoredScenarioStep {
    id: string;
    stepId: string;
    orderIndex: number;
}

export interface StoredAutomationScenario {
    id: string;
    testCaseId: string;
    variables: Record<string, string>;
    steps: StoredScenarioStep[];
    createdAt: string;
    updatedAt: string;
}

export interface ScenarioStepPayload {
    id: string;
    scenarioId: string;
    stepId: string;
    orderIndex: number;
    step: AutomationStepPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

const normalizeActionType = (value: string | null | undefined): AutomationActionType => {
    if (!value) return 'CLICK';
    return (AUTOMATION_ACTION_TYPES as readonly string[]).includes(value) ? (value as AutomationActionType) : 'CLICK';
};

const normalizeVariables = (variables: unknown): Record<string, string> => {
    if (!isRecord(variables)) return {};

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
        if (typeof value === 'string') {
            normalized[key] = value;
        } else if (value === null || value === undefined) {
            normalized[key] = '';
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            normalized[key] = String(value);
        } else {
            try {
                normalized[key] = JSON.stringify(value);
            } catch {
                normalized[key] = '';
            }
        }
    }
    return normalized;
};

export const mapTestStepToAutomationStep = (
    step: Pick<TestStep, 'id' | 'name' | 'action' | 'expectedResult' | 'locator' | 'actionType' | 'data' | 'pageObject' | 'projectId'>,
    usageCount: number = 0
): AutomationStepPayload => {
    return {
        id: step.id,
        name: step.name || step.action || `Step ${step.id.slice(0, 8)}`,
        description: step.expectedResult || undefined,
        locator: step.locator || '',
        actionType: normalizeActionType(step.actionType),
        data: step.data || undefined,
        pageObject: step.pageObject || undefined,
        projectId: step.projectId,
        _count: {
            scenarioSteps: usageCount,
        },
    };
};

export const parseScenarioFromScript = (
    automationScript: string | null | undefined,
    testCaseId: string
): StoredAutomationScenario | null => {
    if (!automationScript || !automationScript.trim()) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(automationScript);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) return null;

    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: StoredScenarioStep[] = [];

    for (let index = 0; index < rawSteps.length; index++) {
        const rawStep = rawSteps[index];
        if (!isRecord(rawStep)) continue;

        const stepId = typeof rawStep.stepId === 'string' ? rawStep.stepId : '';
        if (!stepId) continue;

        const parsedOrder = Number(rawStep.orderIndex);
        const orderIndex = Number.isFinite(parsedOrder) && parsedOrder > 0 ? Math.floor(parsedOrder) : index + 1;

        steps.push({
            id: typeof rawStep.id === 'string' ? rawStep.id : randomUUID(),
            stepId,
            orderIndex,
        });
    }

    steps.sort((a, b) => a.orderIndex - b.orderIndex);

    const nowIso = new Date().toISOString();
    return {
        id: testCaseId,
        testCaseId,
        variables: normalizeVariables(parsed.variables),
        steps,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : nowIso,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso,
    };
};

export const serializeScenario = (scenario: StoredAutomationScenario): string => {
    return JSON.stringify({
        ...scenario,
        updatedAt: new Date().toISOString(),
    });
};

export const buildStepUsageMap = async (projectId: string): Promise<Record<string, number>> => {
    const usage: Record<string, number> = {};

    const cases = await prisma.testCase.findMany({
        where: {
            suite: { projectId },
            automationScript: { not: null },
        },
        select: {
            id: true,
            automationScript: true,
        },
    });

    for (const testCase of cases) {
        const scenario = parseScenarioFromScript(testCase.automationScript, testCase.id);
        if (!scenario) continue;

        for (const step of scenario.steps) {
            usage[step.stepId] = (usage[step.stepId] || 0) + 1;
        }
    }

    return usage;
};

export const hydrateScenarioSteps = async (
    scenario: StoredAutomationScenario,
    projectId: string
): Promise<ScenarioStepPayload[]> => {
    const stepIds = Array.from(new Set(scenario.steps.map((step) => step.stepId)));
    const [steps, usageMap] = await Promise.all([
        stepIds.length > 0
            ? prisma.testStep.findMany({
                where: {
                    id: { in: stepIds },
                    projectId,
                    type: 'WEB',
                },
            })
            : Promise.resolve([]),
        buildStepUsageMap(projectId),
    ]);

    const stepMap = new Map(steps.map((step) => [step.id, step]));

    return scenario.steps
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((scenarioStep) => {
            const rawStep = stepMap.get(scenarioStep.stepId);

            const hydratedStep = rawStep
                ? mapTestStepToAutomationStep(rawStep, usageMap[rawStep.id] || 0)
                : {
                    id: scenarioStep.stepId,
                    name: '[Deleted Step]',
                    description: 'Referenced step no longer exists.',
                    locator: '',
                    actionType: 'CLICK' as AutomationActionType,
                    data: '',
                    projectId,
                    _count: {
                        scenarioSteps: usageMap[scenarioStep.stepId] || 0,
                    },
                };

            return {
                id: scenarioStep.id,
                scenarioId: scenario.id,
                stepId: scenarioStep.stepId,
                orderIndex: scenarioStep.orderIndex,
                step: hydratedStep,
            };
        });
};
