import { api } from './api';
import type { BusinessRequest, BusinessRequestEpic, CreateBusinessRequestInput, UpdateBusinessRequestInput } from '../types/business-request';

export interface AnalyzeBusinessRequestResponse {
    queued: boolean;
    requestId?: string;
    request?: BusinessRequest;
    fallback?: 'synchronous';
    jobId?: string;
}

export const businessRequestService = {
    getAll: async (projectId: string) => {
        const response: any = await api.get(`/projects/${projectId}/business-requests`);
        return response.data;
    },

    create: async (projectId: string, data: CreateBusinessRequestInput) => {
        const response: any = await api.post(`/projects/${projectId}/business-requests`, data);
        return response.data;
    },

    getById: async (projectId: string, id: string) => {
        const response: any = await api.get(`/projects/${projectId}/business-requests/${id}`);
        return response.data;
    },

    getGuidance: async (projectId: string, id: string, language: string = 'en') => {
        const response: any = await api.get(`/projects/${projectId}/business-requests/${id}/guidance?lang=${language}`);
        return response.data;
    },

    update: async (projectId: string, id: string, data: UpdateBusinessRequestInput) => {
        const response: any = await api.patch(`/projects/${projectId}/business-requests/${id}`, data);
        return response.data;
    },

    analyze: async (projectId: string, id: string, language: string = 'en'): Promise<AnalyzeBusinessRequestResponse> => {
        const response: any = await api.post(`/projects/${projectId}/business-requests/${id}/analyze`, { language });
        const payload = response.data;
        return {
            ...payload,
            queued: response.status === 202 ? true : payload.queued,
        };
    },

    approve: async (projectId: string, id: string, epics: BusinessRequestEpic[], language: string = 'en') => {
        const response: any = await api.post(`/projects/${projectId}/business-requests/${id}/approve`, { epics, language });
        return response.data;
    },

    delete: async (projectId: string, id: string) => {
        await api.delete(`/projects/${projectId}/business-requests/${id}`);
    }
};
