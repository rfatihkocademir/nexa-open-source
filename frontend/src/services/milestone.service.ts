import { api } from './api';
import type { Milestone, CreateMilestoneInput, UpdateMilestoneInput } from '@/types/milestone';

export const milestoneService = {
    getAll: async (projectId?: string, page = 1, limit = 10, sortBy = 'dueDate', sortOrder = 'asc', includeDeleted: boolean = false): Promise<{ data: Milestone[], meta: { total: number, page: number, limit: number, totalPages: number } }> => {
        const params: Record<string, string | number> = { page, limit, sortBy, sortOrder };
        if (projectId) params.projectId = projectId;
        if (includeDeleted) params.includeDeleted = 'true';

        const response: any = await api.get('/milestones', { params });
        const resData = response?.data || response;
        return {
            data: Array.isArray(resData?.data) ? resData.data : (Array.isArray(resData) ? resData : []),
            meta: resData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 }
        };
    },

    getById: async (id: string): Promise<Milestone> => {
        const response: any = await api.get(`/milestones/${id}`);
        return response?.data || response;
    },

    create: async (data: CreateMilestoneInput): Promise<Milestone> => {
        const response: any = await api.post('/milestones', data);
        return response?.data || response;
    },

    update: async (id: string, data: UpdateMilestoneInput): Promise<Milestone> => {
        const response: any = await api.patch(`/milestones/${id}`, data);
        return response?.data || response;
    },

    delete: async (id: string, hardDelete = false): Promise<void> => {
        await api.delete(`/milestones/${id}`, { params: { hardDelete } });
    },

    restore: async (id: string): Promise<Milestone> => {
        const response: any = await api.patch(`/milestones/${id}/restore`);
        return response?.data || response;
    },
};
