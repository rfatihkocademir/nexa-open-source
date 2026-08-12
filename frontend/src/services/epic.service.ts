
import { api } from "./api";

export interface Epic {
    id: string;
    title: string;
    description?: string;
    documentationPageId?: string | null;
    status: string;
    priority: string;
    projectId: string;
    _count?: {
        stories: number;
    };
}

export interface CreateEpicInput {
    title: string;
    description?: string;
    priority?: string;
    projectId: string;
    documentationPageId: string;
}

export interface UpdateEpicInput {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    documentationPageId?: string | null;
}

export const epicService = {
    create: async (data: CreateEpicInput): Promise<Epic> => {
        const response: any = await api.post("/epics", data);
        return response?.data || response;
    },

    getAll: async (projectId: string, status?: string): Promise<Epic[]> => {
        const response: any = await api.get("/epics", {
            params: { projectId, status }
        });
        const items = response?.data || response;
        return Array.isArray(items) ? items : [];
    },

    getById: async (id: string): Promise<Epic> => {
        const response: any = await api.get(`/epics/${id}`);
        return response?.data || response;
    },

    update: async (id: string, data: UpdateEpicInput): Promise<Epic> => {
        const response: any = await api.patch(`/epics/${id}`, data);
        return response?.data || response;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/epics/${id}`);
    }
};
