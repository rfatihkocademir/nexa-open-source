import { api } from './api';
import type { Integration, CreateIntegrationDto, UpdateIntegrationDto } from '../types/integration';

export const integrationService = {
    // Get all integrations for a project
    getAll: async (projectId: string): Promise<Integration[]> => {
        const response = await api.get(`/projects/${projectId}/integrations`);
        return response as unknown as Integration[];
    },

    // Create a new integration
    create: async (projectId: string, data: CreateIntegrationDto): Promise<Integration> => {
        const response = await api.post(`/projects/${projectId}/integrations`, data);
        return response as unknown as Integration;
    },

    // Update an integration 
    update: async (projectId: string, id: string, data: UpdateIntegrationDto): Promise<Integration> => {
        const response = await api.put(`/projects/${projectId}/integrations/${id}`, data);
        return response as unknown as Integration;
    },

    // Delete an integration
    delete: async (projectId: string, id: string): Promise<void> => {
        await api.delete(`/projects/${projectId}/integrations/${id}`);
    }
};
