import { api } from './api';

export interface QualityDashboardMetrics {
    rootCauseDistribution: { rootCause: string; count: number }[];
    rootCauseBugs: {
        id: string;
        key: string;
        title: string;
        severity: string | null;
        status: string;
        rootCause: string;
        updatedAt: string;
    }[];
    defectLeakage: { envName: string; total: number; high: number; low: number }[];
    traceability: { totalStories: number; storiesWithTests: number; coveragePercentage: number };
    reopenRate: { totalTransitions: number; reopenCount: number; reopenRate: number };
    mttr: { date: string; avgHours: number }[];
    releaseReadiness: { id: string; title: string; status: string; readinessScore: number; createdAt: string }[];
}

export const analyticsService = {
    getQualityDashboard: async (projectId: string): Promise<QualityDashboardMetrics> => {
        const response: any = await api.get(`/projects/${projectId}/analytics/quality`);
        return response?.data || response;
    }
};
