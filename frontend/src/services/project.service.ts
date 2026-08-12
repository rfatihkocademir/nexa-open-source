import { api } from './api';
import type { Project, CreateProjectInput } from '@/types/project';
import type { ApiResponse } from '@/types/api';

export const projectService = {
    getAvailableTeams: async (): Promise<Array<{ id: string; name: string; slug: string; _count: { members: number; projects: number } }>> => {
        const response = (await api.get<ApiResponse<Array<{ id: string; name: string; slug: string; _count: { members: number; projects: number } }>>>('/projects/available-teams')) as unknown as ApiResponse<Array<{ id: string; name: string; slug: string; _count: { members: number; projects: number } }>>;
        return response.data;
    },
    getAll: async (page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status = 'ACTIVE'): Promise<{ data: Project[], meta: { total: number, page: number, limit: number, totalPages: number } }> => {
        const response = (await api.get<ApiResponse<{ data: Project[], meta: { total: number, page: number, limit: number, totalPages: number } }>>('/projects', {
            params: { page, limit, sortBy, sortOrder, status }
        })) as unknown as ApiResponse<{ data: Project[], meta: { total: number, page: number, limit: number, totalPages: number } }>;
        return response.data;
    },

    getById: async (id: string): Promise<Project> => {
        const response = (await api.get<ApiResponse<Project>>(`/projects/${id}`)) as unknown as ApiResponse<Project>;
        return response.data;
    },

    create: async (data: CreateProjectInput): Promise<Project> => {
        const response = (await api.post<ApiResponse<Project>>('/projects', data)) as unknown as ApiResponse<Project>;
        return response.data;
    },

    update: async (id: string, data: Partial<CreateProjectInput>): Promise<Project> => {
        const response = (await api.patch<ApiResponse<Project>>(`/projects/${id}`, data)) as unknown as ApiResponse<Project>;
        return response.data;
    },

    archive: async (id: string): Promise<Project> => {
        const response = (await api.patch<ApiResponse<Project>>(`/projects/${id}/archive`)) as unknown as ApiResponse<Project>;
        return response.data;
    },

    unarchive: async (id: string): Promise<Project> => {
        const response = (await api.patch<ApiResponse<Project>>(`/projects/${id}/unarchive`)) as unknown as ApiResponse<Project>;
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/projects/${id}`);
    },

    addMember: async (projectId: string, identifier: string): Promise<void> => {
        // Backend determines if it's email or userId
        await api.post(`/projects/${projectId}/members`, {
            [identifier.includes('@') ? 'email' : 'userId']: identifier
        });
    },

    removeMember: async (projectId: string, userId: string): Promise<void> => {
        await api.delete(`/projects/${projectId}/members/${userId}`);
    },

    getWarnings: async (): Promise<{ type: string, message: string, projectId: string }[]> => {
        const response = (await api.get<ApiResponse<{ type: string, message: string, projectId: string }[]>>('/projects/warnings')) as unknown as ApiResponse<{ type: string, message: string, projectId: string }[]>;
        return response.data;
    },
};
