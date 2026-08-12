import { api } from './api';
import type { ApiResponse } from '@/types/api';

export type PortfolioSummary = { id: string; name: string; description?: string; status: string; startDate?: string; targetDate?: string; initiativeCount: number; _count: { programs: number; projects: number }; owner: { id: string; firstName: string; lastName: string } };
export type PortfolioInitiative = { id: string; programId: string; projectId?: string; parentId?: string; title: string; description?: string; status: string; priority: string; startDate?: string; targetDate?: string; estimatedEffortPoints?: number; progress: number; overdue: boolean; riskScore: number; criticalPath?: boolean; project?: { id: string; key: string; name: string }; owner?: { id: string; firstName: string; lastName: string }; incomingDependencies: Array<{ id: string; sourceInitiativeId: string; targetInitiativeId: string; type: string }>; outgoingDependencies: Array<{ id: string; sourceInitiativeId: string; targetInitiativeId: string; type: string }> };
export type PortfolioDashboard = PortfolioSummary & {
    projects: Array<{ id: string; key: string; name: string; qualityTier: string; priority: number; progress: number; openPoints: number; weeklyCapacityMinutes: number; utilization: number; criticalBugs: number; readinessScore?: number }>;
    programs: Array<{ id: string; name: string; description?: string; color: string; startDate?: string; targetDate?: string; initiatives: PortfolioInitiative[] }>;
    metrics: { projectCount: number; initiativeCount: number; atRiskCount: number; blockedCount: number; averageProgress: number; capacityUtilization: number; criticalBugCount: number; criticalPathDays: number };
    criticalPath: { initiativeIds: string[]; durationDays: number };
};
export type PortfolioScenario = { baselineWeeks: number; forecastWeeks: number; availableWeeks?: number; projectedUtilization: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; deltaWeeks: number; targetDate?: string };
const unwrap = <T>(response: unknown) => (response as ApiResponse<T>).data;

export const portfolioService = {
    list: async () => unwrap<PortfolioSummary[]>(await api.get('/portfolios')),
    get: async (id: string) => unwrap<PortfolioDashboard>(await api.get(`/portfolios/${id}`)),
    create: async (data: Record<string, unknown>) => unwrap<PortfolioSummary>(await api.post('/portfolios', data)),
    createProgram: async (id: string, data: Record<string, unknown>) => unwrap(await api.post(`/portfolios/${id}/programs`, data)),
    linkProject: async (id: string, data: Record<string, unknown>) => unwrap(await api.post(`/portfolios/${id}/projects`, data)),
    createInitiative: async (id: string, data: Record<string, unknown>) => unwrap(await api.post(`/portfolios/${id}/initiatives`, data)),
    updateInitiative: async (id: string, initiativeId: string, data: Record<string, unknown>) => unwrap(await api.patch(`/portfolios/${id}/initiatives/${initiativeId}`, data)),
    addDependency: async (id: string, data: Record<string, unknown>) => unwrap(await api.post(`/portfolios/${id}/dependencies`, data)),
    scenario: async (id: string, data: Record<string, unknown>) => unwrap<PortfolioScenario>(await api.post(`/portfolios/${id}/scenario`, data)),
};
