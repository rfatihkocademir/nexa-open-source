import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { TestSuite, CreateSuiteInput, UpdateSuiteInput } from '@/types/testSuite';

export const testSuiteService = {
    getAll: async (projectId: string, includeDeleted: boolean = false): Promise<{ items: TestSuite[], pagination: { total: number, page: number, limit: number, totalPages: number } }> => {
        const response = (await api.get<ApiResponse<{ items: TestSuite[], pagination: { total: number, page: number, limit: number, totalPages: number } }>>(`/suites`, {
            params: { projectId, includeDeleted: includeDeleted ? 'true' : undefined },
        })) as unknown as ApiResponse<{ items: TestSuite[], pagination: { total: number, page: number, limit: number, totalPages: number } }>;
        return response.data;
    },

    getById: async (id: string): Promise<TestSuite> => {
        const response = (await api.get<ApiResponse<TestSuite>>(`/suites/${id}`)) as unknown as ApiResponse<TestSuite>;
        return response.data;
    },

    create: async (data: CreateSuiteInput): Promise<TestSuite> => {
        const response = (await api.post<ApiResponse<TestSuite>>('/suites', data)) as unknown as ApiResponse<TestSuite>;
        return response.data;
    },

    update: async (id: string, data: UpdateSuiteInput): Promise<TestSuite> => {
        const response = (await api.patch<ApiResponse<TestSuite>>(`/suites/${id}`, data)) as unknown as ApiResponse<TestSuite>;
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/suites/${id}`);
    },

    restore: async (id: string): Promise<void> => {
        await api.post(`/suites/${id}/restore`);
    },
};

