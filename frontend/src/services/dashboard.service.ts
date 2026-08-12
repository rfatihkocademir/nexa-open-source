import { api } from './api';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/project';

export interface WorkspaceOverview {
    projects: Array<Pick<Project, 'id' | 'key' | 'name'> & {
        _count: { suites: number; testRuns: number };
    }>;
    totals: { projects: number; suites: number; testRuns: number; members: number };
}

export interface ExecutionSummary {
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
}

export interface MyWorkQueue {
    workItems: Array<{
        id: string;
        key: string;
        title: string;
        itemType: string;
        status: string;
        priority: string;
        updatedAt: string;
        project: { key: string; name: string };
    }>;
    testItems: Array<{
        id: string;
        caseTitle: string | null;
        casePriority: string | null;
        finalStatus: string;
        testRun: {
            key: string;
            title: string;
            dueDate: string | null;
            project: { key: string; name: string } | null;
        };
    }>;
}

export interface ProjectStats {
    sprint: {
        id: string;
        name: string;
        goal: string | null;
        startDate: string | null;
        endDate: string | null;
        totalPoints: number;
        completedPoints: number;
        progress: number;
        daysRemaining: number;
    } | null;
    stories: {
        total: number;
        byStatus: Record<string, number>;
    };
    bugs: {
        total: number;
        openTotal: number;
        bySeverity: Record<string, number>;
        byStatus: Record<string, number>;
    };
    testCases: {
        total: number;
        byStatus: Record<string, number>;
    };
    testRuns: {
        total: number;
        active: number;
    };
    execution: {
        byStatus: Record<string, number>;
        qgi: number;
        velocity: number;
        passRate: number;
        coverage: number;
        stability: number;
    };
    velocityHistory?: Array<{
        name: string;
        completedPoints: number;
        totalPoints: number;
    }>;
}

export type MetricsTimeframe = 'WEEK' | 'SPRINT' | 'MONTH';

export interface ManagementMetrics {
    timeframe: MetricsTimeframe;
    period: { start: string; end: string };
    qgi: number;
    passRate: number;
    failRate: number;
    retestRate: number;
    conflictRate: number;
    velocity: number;
    defectTrend: number;
    nextActions?: Array<{
        type: string;
        metric: string;
        value: number;
        suggestion: string;
    }>;
}

export interface PerformanceMetricsRow {
    testerId: string;
    name: string;
    total: number;
    passRate: number;
    failRate: number;
    retestRate: number;
    blockRate: number;
    velocity: number;
    avgDurationMs: number;
}

export interface RecentActivity {
    id: string;
    type: 'RUN_CREATED' | 'TEST_EXECUTED' | 'CASE_UPDATED';
    description: string;
    user: string;
    project: string;
    timestamp: string;
    meta?: Record<string, unknown>;
}

export const dashboardService = {
    getMyWorkQueue: async (): Promise<MyWorkQueue> => {
        const response = (await api.get<ApiResponse<MyWorkQueue>>('/dashboard/my-work')) as unknown as ApiResponse<MyWorkQueue>;
        return response.data;
    },
    getExecutionSummary: async (): Promise<ExecutionSummary> => {
        const response = (await api.get<ApiResponse<ExecutionSummary>>('/dashboard/execution-summary')) as unknown as ApiResponse<ExecutionSummary>;
        return response.data;
    },
    getWorkspaceOverview: async (): Promise<WorkspaceOverview> => {
        const response = (await api.get<ApiResponse<WorkspaceOverview>>('/dashboard/overview')) as unknown as ApiResponse<WorkspaceOverview>;
        return response.data;
    },
    getProjectStats: async (projectId: string): Promise<ProjectStats> => {
        const response = (await api.get<ApiResponse<ProjectStats>>('/dashboard/stats', {
            params: { projectId },
        })) as unknown as ApiResponse<ProjectStats>;
        return response.data;
    },
    getManagementMetrics: async (projectId: string, timeframe: MetricsTimeframe): Promise<ManagementMetrics> => {
        const response = (await api.get<ApiResponse<ManagementMetrics>>('/dashboard/management', {
            params: { projectId, timeframe },
        })) as unknown as ApiResponse<ManagementMetrics>;
        return response.data;
    },
    getPerformanceMetrics: async (projectId: string, timeframe: MetricsTimeframe): Promise<PerformanceMetricsRow[]> => {
        const response = (await api.get<ApiResponse<PerformanceMetricsRow[]>>('/dashboard/performance', {
            params: { projectId, timeframe },
        })) as unknown as ApiResponse<PerformanceMetricsRow[]>;
        return response.data;
    },
    getRecentActivities: async (): Promise<RecentActivity[]> => {
        const response = (await api.get<ApiResponse<RecentActivity[]>>('/dashboard/recent-activities')) as unknown as ApiResponse<RecentActivity[]>;
        return response.data;
    },
    globalSearch: async (query: string): Promise<SearchResult[]> => {
        const response = (await api.get<ApiResponse<SearchResult[]>>('/dashboard/search', {
            params: { q: query },
        })) as unknown as ApiResponse<SearchResult[]>;
        return response.data;
    },
};

export interface SearchResult {
    id: string;
    type: 'PROJECT' | 'SUITE' | 'CASE' | 'RUN' | 'MILESTONE' | 'WORK_ITEM';
    name: string;
    detail?: string;
    path: string;
    meta?: Record<string, unknown>;
}
