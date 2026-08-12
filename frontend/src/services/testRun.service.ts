import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { 
    TestRun, 
    CreateTestRunInput, 
    AddResultInput, 
    TestResult, 
    PaginationMeta, 
    ConflictItem, 
    ComparisonReport, 
    RunReport 
} from '@/types/testRun';

export const testRunService = {
    getAll: async (
        projectId?: string, 
        isGlobal?: boolean, 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        sortOrder = 'desc'
    ): Promise<{ data: TestRun[], meta: PaginationMeta }> => {
        const params: Record<string, string | number | boolean | undefined> = { page, limit, sortBy, sortOrder };
        if (projectId) params.projectId = projectId;
        if (isGlobal) params.global = 'true';

        const response = (await api.get<ApiResponse<{ data: TestRun[], meta: PaginationMeta }>>('/runs', {
            params,
        })) as unknown as ApiResponse<{ data: TestRun[], meta: PaginationMeta }>;
        return response.data;
    },

    getById: async (id: string): Promise<TestRun> => {
        const response = (await api.get<ApiResponse<TestRun>>(`/runs/${id}`)) as unknown as ApiResponse<TestRun>;
        return response.data;
    },

    create: async (data: CreateTestRunInput): Promise<TestRun> => {
        const response = (await api.post<ApiResponse<TestRun>>('/runs', data)) as unknown as ApiResponse<TestRun>;
        return response.data;
    },

    addResult: async (itemId: string, data: AddResultInput): Promise<TestResult> => {
        const response = (await api.post<ApiResponse<TestResult>>(`/items/${itemId}/results`, data)) as unknown as ApiResponse<TestResult>;
        return response.data;
    },

    update: async (id: string, data: Partial<CreateTestRunInput> & { status?: string }): Promise<TestRun> => {
        const response = (await api.patch<ApiResponse<TestRun>>(`/runs/${id}`, data)) as unknown as ApiResponse<TestRun>;
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/runs/${id}`);
    },

    getConflicts: async (id: string): Promise<ConflictItem[]> => {
        const response: any = await api.get(`/runs/${id}/conflicts`);
        return response?.data ?? response;
    },

    getComparisonReport: async (id: string): Promise<ComparisonReport> => {
        const response: any = await api.get(`/runs/${id}/comparison-report`);
        return response?.data ?? response;
    },

    getReport: async (id: string): Promise<RunReport> => {
        const response: any = await api.get(`/runs/${id}/report`);
        return response?.data ?? response;
    },

    addAutomationResult: async (itemId: string, data: { status: string; duration?: number; errorOutput?: string; videoUrl?: string }): Promise<TestResult> => {
        const response: any = await api.patch(`/items/${itemId}/automation-result`, data);
        return response?.data ?? response;
    },

    triggerAutomation: async (id: string): Promise<void> => {
        await api.post(`/runs/${id}/execute-automation`);
    },

    triggerItemAutomation: async (itemId: string): Promise<void> => {
        await api.post(`/runs/items/${itemId}/trigger`);
    },

    notifyCompletion: async (runId: string): Promise<void> => {
        await api.post(`/runs/${runId}/notify-completion`);
    },

    addItems: async (runId: string, testCaseIds: string[]): Promise<void> => {
        await api.post(`/runs/${runId}/items`, { testCaseIds });
    },

    deleteItem: async (itemId: string): Promise<void> => {
        await api.delete(`/runs/items/${itemId}`);
    },

    createQuickRun: async (testCaseId: string): Promise<TestRun> => {
        const response: any = await api.post('/runs/quick-run', { testCaseId });
        return response?.data ?? response;
    },

    assignItem: async (itemId: string, userId: string): Promise<void> => {
        await api.patch(`/runs/items/${itemId}/assign`, { userId });
    },
};
