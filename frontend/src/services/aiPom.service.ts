import { api } from './api';
import { aiService } from './ai.service';

export interface ProjectElement {
    id: string;
    projectId: string;
    name: string;
    locator: string;
    type: string;
    pageUrl?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export const aiPomService = {
    extractFromHtml: async (projectId: string, htmlSnippet: string) => {
        return aiService.extractElementsFromHtml(projectId, htmlSnippet) as Promise<Partial<ProjectElement>[]>;
    },

    getElements: async (projectId: string) => {
        const response = await api.get(`/projects/${projectId}/elements`);
        return (response as any).data as ProjectElement[];
    },

    saveElement: async (projectId: string, elementData: Partial<ProjectElement>) => {
        const response = await api.post(`/projects/${projectId}/elements`, elementData);
        return (response as any).data as ProjectElement;
    },

    deleteElement: async (projectId: string, elementId: string) => {
        const response = await api.delete(`/projects/${projectId}/elements/${elementId}`);
        return response as any;
    }
};
