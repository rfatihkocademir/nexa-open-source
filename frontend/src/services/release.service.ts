import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { CreateReleaseCandidateInput, CreateReleaseFollowUpInput, ProjectQualityTier, ReleaseAISummary, ReleaseCandidate, ReleaseGovernanceState, ReleaseStatus, StakeholderDecision } from '@/types/release';

export const releaseService = {
    getAll: async (projectId: string): Promise<ReleaseCandidate[]> => {
        const response = (await api.get<ApiResponse<ReleaseCandidate[]>>(`/projects/${projectId}/releases`)) as unknown as ApiResponse<ReleaseCandidate[]>;
        return response.data;
    },

    getById: async (projectId: string, releaseId: string): Promise<ReleaseCandidate> => {
        const response = (await api.get<ApiResponse<ReleaseCandidate>>(`/projects/${projectId}/releases/${releaseId}`)) as unknown as ApiResponse<ReleaseCandidate>;
        return response.data;
    },

    getAISummary: async (projectId: string, releaseId: string): Promise<ReleaseAISummary> => {
        const response = (await api.get<ApiResponse<ReleaseAISummary>>(`/projects/${projectId}/releases/${releaseId}/ai-summary`)) as unknown as ApiResponse<ReleaseAISummary>;
        return response.data;
    },

    create: async (projectId: string, payload: CreateReleaseCandidateInput): Promise<ReleaseCandidate> => {
        const response = (await api.post<ApiResponse<ReleaseCandidate>>(`/projects/${projectId}/releases`, payload)) as unknown as ApiResponse<ReleaseCandidate>;
        return response.data;
    },

    addDecision: async (
        projectId: string,
        releaseId: string,
        payload: { type: string; outcome: string; rationale?: string; confidence?: number }
    ): Promise<ReleaseCandidate> => {
        const response = (await api.post<ApiResponse<ReleaseCandidate>>(`/projects/${projectId}/releases/${releaseId}/decisions`, payload)) as unknown as ApiResponse<ReleaseCandidate>;
        return response.data;
    },

    createFollowUp: async (
        projectId: string,
        releaseId: string,
        payload: CreateReleaseFollowUpInput
    ): Promise<ReleaseCandidate> => {
        const response = (await api.post<ApiResponse<ReleaseCandidate>>(`/projects/${projectId}/releases/${releaseId}/follow-ups`, payload)) as unknown as ApiResponse<ReleaseCandidate>;
        return response.data;
    },

    updateStatus: async (projectId: string, releaseId: string, status: ReleaseStatus): Promise<ReleaseCandidate> => {
        const response = (await api.patch<ApiResponse<ReleaseCandidate>>(`/projects/${projectId}/releases/${releaseId}/status`, { status })) as unknown as ApiResponse<ReleaseCandidate>;
        return response.data;
    },

    getGovernance: async (projectId: string, releaseId: string): Promise<ReleaseGovernanceState> => {
        const response = (await api.get<ApiResponse<ReleaseGovernanceState>>(`/projects/${projectId}/releases/${releaseId}/governance`)) as unknown as ApiResponse<ReleaseGovernanceState>;
        return response.data;
    },

    updateQualityTier: async (projectId: string, qualityTier: ProjectQualityTier) => {
        const response = (await api.patch<ApiResponse<{ qualityTier: ProjectQualityTier }>>(`/projects/${projectId}/releases/quality-tier`, { qualityTier })) as unknown as ApiResponse<{ qualityTier: ProjectQualityTier }>;
        return response.data;
    },

    startApprovalRound: async (projectId: string, releaseId: string) => {
        const response = (await api.post<ApiResponse<unknown>>(`/projects/${projectId}/releases/${releaseId}/approval-rounds`)) as unknown as ApiResponse<unknown>;
        return response.data;
    },

    submitApprovalDecision: async (projectId: string, releaseId: string, roundId: string, decision: StakeholderDecision, rationale: string) => {
        const response = (await api.put<ApiResponse<unknown>>(`/projects/${projectId}/releases/${releaseId}/approval-rounds/${roundId}/decision`, { decision, rationale })) as unknown as ApiResponse<unknown>;
        return response.data;
    },

    createDeployPackage: async (projectId: string, releaseId: string) => {
        const response = (await api.post<ApiResponse<unknown>>(`/projects/${projectId}/releases/${releaseId}/deploy-packages`)) as unknown as ApiResponse<unknown>;
        return response.data;
    },
};
