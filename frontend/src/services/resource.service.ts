import { api } from './api';
import type { ApiResponse } from '@/types/api';

export type ResourceType = 'WORK_ITEM' | 'TEST_CASE' | 'TEST_RUN' | 'MILESTONE' | 'RELEASE_CANDIDATE' | 'WIKI_PAGE';

export interface ResolvedResource {
    type: ResourceType;
    id: string;
    key: string;
    projectId: string | null;
    projectKey: string | null;
    projectSlug: string | null;
    teamSlug: string;
    canonicalType: string;
    canonicalPath: string;
    titleSlug?: string | null;
}

export interface ResolvedProject {
    id: string;
    key: string;
    slug: string;
    teamSlug: string;
    canonicalPath: string;
}

export const resourceService = {
    resolveProject: async (key: string): Promise<ResolvedProject> => {
        const response = (await api.get<ApiResponse<ResolvedProject>>(`/resources/projects/${encodeURIComponent(key)}`)) as unknown as ApiResponse<ResolvedProject>;
        return response.data;
    },
    resolve: async (key: string): Promise<ResolvedResource> => {
        const response = (await api.get<ApiResponse<ResolvedResource>>(`/resources/${encodeURIComponent(key)}`)) as unknown as ApiResponse<ResolvedResource>;
        return response.data;
    },
};
