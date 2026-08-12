import { api } from './api';
import type { ApiResponse } from '@/types/api';

export const ActionType = {
    NAVIGATE: 'NAVIGATE',
    CLICK: 'CLICK',
    FILL: 'FILL',
    ASSERT_TEXT: 'ASSERT_TEXT',
    ASSERT_VISIBLE: 'ASSERT_VISIBLE',
    WAIT: 'WAIT',
    SELECT: 'SELECT',
    SET_COOKIE: 'SET_COOKIE',
    SET_LOCAL_STORAGE: 'SET_LOCAL_STORAGE',
    API_REQUEST: 'API_REQUEST',
} as const;

export type ActionType = typeof ActionType[keyof typeof ActionType];

export interface AutomationCoverageMetrics {
    coveragePercentage: number;
    automatedTestCases: number;
    totalTestCases: number;
    hoursSaved: number;
    passRate: number;
    totalExecutions: number;
    manualTestCases: number;
    gridBrowsers: Array<{ name: string; passRate: number }>;
    deviceProfiles: Array<{ name: string; type: string; os: string; resolution: string }>;
}

export interface AutomationStep {
    id: string;
    name: string;
    description?: string;
    locator: string;
    actionType: ActionType;
    data?: string;
    pageObject?: string;
    projectId: string;
    _count?: {
        scenarioSteps: number;
    };
}

export interface CreateStepInput {
    name: string;
    description?: string;
    locator: string;
    actionType: ActionType;
    data?: string;
    pageObject?: string;
    projectId: string;
}

export interface AutomationScenario {
    id: string;
    testCaseId: string;
    steps: ScenarioStep[];
    variables?: Record<string, string>;
    title?: string;
    description?: string | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
    version?: number;
    testCase?: {
        id: string;
        title: string;
    };
}

export interface ScenarioStep {
    id: string;
    stepId: string;
    step: AutomationStep;
    orderIndex: number;
}

export interface CreateScenarioInput {
    testCaseId: string;
    steps: { stepId: string; orderIndex: number }[];
    variables?: Record<string, string>;
    title?: string;
    description?: string;
}

export interface SuggestedStep {
    name: string;
    locator: string;
    actionType: ActionType;
    description?: string;
    confidence: number;
}

export interface StepExecutionResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped' | 'timedOut';
    duration: number;
    error?: string;
}

export interface DryRunResult {
    status: 'PASS' | 'FAIL';
    duration: number;
    logs: string;
    steps?: StepExecutionResult[];
    videoUrl?: string;
}

export interface DryRunStatusResponse {
    dryRunId: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    startedAt?: string;
    completedAt?: string;
    result?: DryRunResult;
    error?: string;
}

export const automationService = {
    // Steps
    getSteps: async (projectId: string): Promise<AutomationStep[]> => {
        const response = (await api.get<ApiResponse<AutomationStep[]>>('/automation/steps', {
            params: { projectId },
        })) as unknown as ApiResponse<AutomationStep[]>;
        return response.data;
    },

    createStep: async (data: CreateStepInput): Promise<AutomationStep> => {
        const response = (await api.post<ApiResponse<AutomationStep>>('/automation/steps', data)) as unknown as ApiResponse<AutomationStep>;
        return response.data;
    },

    updateStep: async (id: string, data: Partial<CreateStepInput>): Promise<AutomationStep> => {
        const response = (await api.patch<ApiResponse<AutomationStep>>(`/automation/steps/${id}`, data)) as unknown as ApiResponse<AutomationStep>;
        return response.data;
    },

    deleteStep: async (id: string): Promise<void> => {
        await api.delete(`/automation/steps/${id}`);
    },

    suggestSteps: async (projectId: string, html: string): Promise<SuggestedStep[]> => {
        const response = (await api.post<ApiResponse<SuggestedStep[]>>('/automation/steps/suggest', { projectId, html })) as unknown as ApiResponse<SuggestedStep[]>;
        return response.data;
    },

    // Scenarios
    getScenarioByTestCase: async (testCaseId: string): Promise<AutomationScenario | null> => {
        try {
            const response = (await api.get<ApiResponse<AutomationScenario | null>>(`/automation/scenarios/testcase/${testCaseId}`)) as unknown as ApiResponse<AutomationScenario | null>;
            return response.data;
        } catch (error: any) {
            // A missing scenario is an expected empty state. Auth, network,
            // and server errors must remain visible to the query layer.
            if (error?.response?.status === 404) return null;
            throw error;
        }
    },

    createScenario: async (data: CreateScenarioInput): Promise<AutomationScenario> => {
        const response = (await api.post<ApiResponse<AutomationScenario>>('/automation/scenarios', data)) as unknown as ApiResponse<AutomationScenario>;
        return response.data;
    },

    updateScenario: async (id: string, data: Partial<CreateScenarioInput>): Promise<AutomationScenario> => {
        const response = (await api.patch<ApiResponse<AutomationScenario>>(`/automation/scenarios/${id}`, data)) as unknown as ApiResponse<AutomationScenario>;
        return response.data;
    },

    publishScenario: async (id: string): Promise<AutomationScenario> => {
        const response = (await api.post<ApiResponse<AutomationScenario>>(`/automation/scenarios/${id}/publish`)) as unknown as ApiResponse<AutomationScenario>;
        return response.data;
    },

    dryRun: async (projectId: string, steps: AutomationStep[], variables: Record<string, string>, headless: boolean = true): Promise<DryRunResult> => {
        const response = (await api.post<ApiResponse<DryRunResult>>('/automation/scenarios/dry-run', { projectId, steps, variables, headless })) as unknown as ApiResponse<DryRunResult>;
        return response.data;
    },

    startDryRun: async (projectId: string, steps: AutomationStep[], variables: Record<string, string>, headless: boolean = true): Promise<{ dryRunId: string }> => {
        const response = (await api.post<ApiResponse<{ dryRunId: string }>>('/automation/scenarios/dry-run/start', { projectId, steps, variables, headless })) as unknown as ApiResponse<{ dryRunId: string }>;
        return response.data;
    },

    getDryRunStatus: async (dryRunId: string): Promise<DryRunStatusResponse> => {
        const response = (await api.get<ApiResponse<DryRunStatusResponse>>(`/automation/scenarios/dry-run/${dryRunId}`)) as unknown as ApiResponse<DryRunStatusResponse>;
        return response.data;
    },

    getLiveFrame: async (dryRunId: string): Promise<{ frame: string; updatedAt: number } | null> => {
        try {
            const response = (await api.get<ApiResponse<{ frame: string; updatedAt: number }>>(`/automation/scenarios/dry-run/${dryRunId}/frame`)) as unknown as ApiResponse<{ frame: string; updatedAt: number }>;
            return response.data;
        } catch {
            return null;
        }
    },

    clearDryRun: async (dryRunId: string): Promise<void> => {
        await api.delete(`/automation/scenarios/dry-run/${dryRunId}`);
    },

    // Scenario Steps
    addStepToScenario: async (scenarioId: string, stepId: string, orderIndex: number): Promise<ScenarioStep> => {
        const response = (await api.post<ApiResponse<ScenarioStep>>('/automation/scenario-steps', {
            scenarioId,
            stepId,
            orderIndex,
        })) as unknown as ApiResponse<ScenarioStep>;
        return response.data;
    },

    removeStepFromScenario: async (id: string): Promise<void> => {
        await api.delete(`/automation/scenario-steps/${id}`);
    },

    reorderSteps: async (scenarioId: string, steps: { id: string; orderIndex: number }[]): Promise<void> => {
        await api.patch('/automation/scenario-steps/reorder', {
            scenarioId,
            steps,
        });
    },

    cleanupVideo: async (projectId: string, videoUrl: string): Promise<void> => {
        await api.post('/automation/scenarios/cleanup-video', { projectId, videoUrl });
    },

    // AI Manual-to-Automation Converter
    convertManualToAutomation: async (testCaseId: string): Promise<any> => {
        const response = (await api.post<ApiResponse<any>>('/automation-coverage/convert-manual', { testCaseId })) as unknown as ApiResponse<any>;
        return response.data;
    },

    // Automation Coverage Metrics
    getCoverageMetrics: async (projectId: string): Promise<AutomationCoverageMetrics> => {
        const response = (await api.get<ApiResponse<AutomationCoverageMetrics>>('/automation-coverage/coverage', { params: { projectId } })) as unknown as ApiResponse<AutomationCoverageMetrics>;
        return response.data;
    },
};
