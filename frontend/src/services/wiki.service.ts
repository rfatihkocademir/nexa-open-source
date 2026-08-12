import { api } from './api';
import type { WikiSpace, WikiPage, CreateSpaceDTO, CreatePageDTO, UpdatePageDTO } from '@/types/wiki';

// Wiki backend controllers use res.json() directly (not sendResponse wrapper),
// so the axios interceptor already returns the raw data.
// We handle both wrapped { data: T } and raw T formats for safety.
function unwrap<T>(response: unknown): T {
    if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data: T }).data;
    }
    return response as T;
}

export const wikiService = {
    getSpaces: async (projectId: string, includeDeleted: boolean = false): Promise<WikiSpace[]> => {
        const response = await api.get(`/projects/${projectId}/wiki/spaces`, { params: includeDeleted ? { includeDeleted: 'true' } : {} });
        return unwrap<WikiSpace[]>(response);
    },

    createSpace: async (projectId: string, data: CreateSpaceDTO): Promise<WikiSpace> => {
        const response = await api.post(`/projects/${projectId}/wiki/spaces`, data);
        return unwrap<WikiSpace>(response);
    },

    getPageTree: async (spaceId: string, includeDeleted: boolean = false): Promise<WikiPage[]> => {
        const response = await api.get(`/wiki/spaces/${spaceId}/tree`, { params: includeDeleted ? { includeDeleted: 'true' } : {} });
        return unwrap<WikiPage[]>(response);
    },

    getPage: async (pageId: string): Promise<WikiPage> => {
        const response = await api.get(`/wiki/pages/${pageId}`);
        return unwrap<WikiPage>(response);
    },

    createPage: async (data: CreatePageDTO): Promise<WikiPage> => {
        const response = await api.post('/wiki/pages', data);
        return unwrap<WikiPage>(response);
    },

    updatePage: async (pageId: string, data: UpdatePageDTO): Promise<WikiPage> => {
        const response = await api.put(`/wiki/pages/${pageId}`, data);
        return unwrap<WikiPage>(response);
    },

    restoreSpace: async (projectId: string, spaceId: string): Promise<WikiSpace> => {
        const response = await api.patch(`/projects/${projectId}/wiki/spaces/${spaceId}/restore`);
        return unwrap<WikiSpace>(response);
    },

    restorePage: async (pageId: string): Promise<WikiPage> => {
        const response = await api.patch(`/wiki/pages/${pageId}/restore`);
        return unwrap<WikiPage>(response);
    },
    
    deletePage: async (pageId: string): Promise<WikiPage> => {
        const response = await api.delete(`/wiki/pages/${pageId}`);
        return unwrap<WikiPage>(response);
    },

    deleteSpace: async (projectId: string, spaceId: string): Promise<WikiSpace> => {
        const response = await api.delete(`/projects/${projectId}/wiki/spaces/${spaceId}`);
        return unwrap<WikiSpace>(response);
    }
};
