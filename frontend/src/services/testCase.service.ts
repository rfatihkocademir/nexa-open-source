import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { PaginationMeta } from '@/types/testRun';
import type { TestCase, CreateTestCaseInput, UpdateTestCaseInput, CaseStatus, Step } from '@/types/testCase';

export interface TestCaseHistoryEntry {
    id: string;
    version: number;
    title: string;
    steps: Step[];
    preconditions?: string | null;
    changedAt: string;
    changedBy?: {
        firstName: string;
        lastName: string;
    };
}

export interface TestCaseSearchResult {
    data: TestCase[];
    meta: PaginationMeta;
}

export const testCaseService = {
    getAll: async (suiteId?: string, includeDeleted: boolean = false): Promise<TestCase[]> => {
        const response = (await api.get<ApiResponse<TestCase[]>>('/cases', {
            params: { suiteId, includeDeleted },
        })) as unknown as ApiResponse<TestCase[]>;
        return response.data;
    },

    getAllByProject: async (projectId?: string, page = 1, limit = 50, search = ""): Promise<TestCaseSearchResult> => {
        const response = (await api.get<ApiResponse<TestCaseSearchResult>>('/cases/search', {
            params: { projectId, page, limit, search },
        })) as unknown as ApiResponse<TestCaseSearchResult>;
        return response.data;
    },

    getById: async (id: string): Promise<TestCase> => {
        const response = (await api.get<ApiResponse<TestCase>>(`/cases/${id}`)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    getByKey: async (key: string): Promise<TestCase> => {
        const response = (await api.get<ApiResponse<TestCase>>(`/cases/key/${encodeURIComponent(key)}`)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    create: async (data: CreateTestCaseInput): Promise<TestCase> => {
        const response = (await api.post<ApiResponse<TestCase>>('/cases', data)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    update: async (id: string, data: UpdateTestCaseInput): Promise<TestCase> => {
        const response = (await api.patch<ApiResponse<TestCase>>(`/cases/${id}`, data)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    delete: async (id: string, hardDelete: boolean = false): Promise<void> => {
        await api.delete(`/cases/${id}`, {
            params: { hardDelete }
        });
    },

    restore: async (id: string): Promise<void> => {
        await api.post(`/cases/${id}/restore`);
    },

    approve: async (id: string): Promise<TestCase> => {
        const response = (await api.patch<ApiResponse<TestCase>>(`/cases/${id}/approve`)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    requestRevision: async (id: string, comment?: string): Promise<TestCase> => {
        const response = (await api.patch<ApiResponse<TestCase>>(`/cases/${id}/request-revision`, { comment })) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    getHistory: async (id: string): Promise<TestCaseHistoryEntry[]> => {
        const response = (await api.get<ApiResponse<TestCaseHistoryEntry[]>>(`/cases/${id}/history`)) as unknown as ApiResponse<TestCaseHistoryEntry[]>;
        return response.data;
    },

    move: async (id: string, targetSuiteId: string): Promise<TestCase> => {
        const response = (await api.patch<ApiResponse<TestCase>>(`/cases/${id}/move`, { targetSuiteId })) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    revertToVersion: async (id: string, version: number): Promise<TestCase> => {
        const response = (await api.post<ApiResponse<TestCase>>(`/cases/${id}/revert/${version}`)) as unknown as ApiResponse<TestCase>;
        return response.data;
    },

    bulkDelete: async (ids: string[], hardDelete: boolean = false): Promise<void> => {
        await api.post('/cases/bulk/delete', { ids, hardDelete });
    },

    bulkUpdateStatus: async (ids: string[], status: CaseStatus): Promise<void> => {
        await api.post('/cases/bulk/status', { ids, status });
    },
};
