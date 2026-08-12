import { api } from "./api";
import type { Sprint, SprintStatus } from "@/types/agile";

export interface SprintPlanningReport {
    sprint: { id: string; name: string; status: SprintStatus; goal?: string | null; startDate: string; endDate: string; workingDays: number; capacityPoints: number; capacitySource: string };
    summary: { readinessScore: number; totalPoints: number; capacityPoints: number; pointUtilization: number; teamGrossMinutes: number; teamNetMinutes: number; focusReserveMinutes: number; forecastConfidence: number | null; unplannedBufferPercent: number };
    dimensions: Record<'goal' | 'capacity' | 'estimated' | 'assigned' | 'acceptance' | 'testable', number>;
    blockers: string[];
    members: Array<{ userId: string; name: string; role: string; grossMinutes: number; netMinutes: number; focusFactor: number; deductions: number; dailyCapacityMinutes: number; leaveMinutes: number; meetingMinutes: number; supportMinutes: number; disciplineAllocations: Array<{ discipline: string; percent: number }>; skills: Array<string | { name: string; level?: number }>; assignedItems: number; assignedPoints: number; pointBudget: number; utilization: number }>;
    bottlenecks: Array<{ userId: string; name: string; utilization: number }>;
    disciplineCapacity: Record<string, number>;
    disciplineDemand: Record<string, number>;
    disciplineBottlenecks: Array<{ discipline: string; demandMinutes: number; capacityMinutes: number; utilization: number }>;
    skillCoverage: Record<string, number>;
    skillGaps: Array<{ skill: string; requiredBy: string[] }>;
    holidays: Array<{ id: string; name: string; date: string; durationMinutes?: number | null }>;
    exceptions: Array<{ id: string; date: string; type: string; minutes: number; description?: string | null; memberCapacityId?: string | null }>;
    planningItems: Array<{ id: string; key: string; title: string; storyPoints?: number | null; inSprint: boolean; estimate?: { optimisticMinutes: number; mostLikelyMinutes: number; pessimisticMinutes: number; valueScore: number; riskScore: number; confidence: number; refinementReady: boolean; disciplineDemands?: Array<{ discipline: string; minutes: number; skill?: string }> } | null; dependencies: Array<{ id: string; targetWorkItemId: string; type: string }> }>;
    activeSession?: { id: string; status: 'PREPARING' | 'IN_PROGRESS' | 'LOCKED' | 'COMPLETED'; startedAt?: string | null } | null;
    outcome?: { id: string; plannedPoints: number; plannedMinutes: number; completedPoints: number; completedMinutes: number; spilloverPoints: number; unplannedPoints: number; meetingDurationMinutes: number; forecastConfidence?: number | null; calculatedAt: string } | null;
    calibration: Array<{ id: string; plannedPoints: number; completedPoints: number; spilloverPoints: number; unplannedPoints: number; meetingDurationMinutes: number; forecastConfidence?: number | null; calculatedAt: string }>;
    scenarios: Array<{ key: 'SAFE' | 'BALANCED' | 'AGGRESSIVE'; confidence: number; targetConfidence: number; pointLimit: number; recommendedPoints: number; historicalSamples: number; simulations: number; recommendedItems: Array<{ id: string; key: string; title: string; storyPoints: number; priority: string }> }>;
}

export interface CreateSprintInput {
    name: string;
    projectId: string;
    startDate: string;
    endDate: string;
    goal?: string;
    capacityPoints?: number;
}

export interface UpdateSprintInput {
    name?: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
    status?: SprintStatus;
    capacityPoints?: number | null;
}

export interface SprintFilters {
    status?: SprintStatus;
}

export const sprintService = {
    getAll: async (projectId: string, filters?: SprintFilters): Promise<Sprint[]> => {
        const response = await api.get<Sprint[]>("/sprints", { params: { projectId, ...filters } });
        return response as unknown as Sprint[];
    },

    getById: async (id: string): Promise<Sprint> => {
        const response = await api.get<Sprint>(`/sprints/${id}`);
        return response as unknown as Sprint;
    },

    create: async (data: CreateSprintInput): Promise<Sprint> => {
        const response = await api.post<Sprint>("/sprints", data);
        return response as unknown as Sprint;
    },

    update: async (id: string, data: UpdateSprintInput): Promise<Sprint> => {
        const response = await api.patch<Sprint>(`/sprints/${id}`, data);
        return response as unknown as Sprint;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/sprints/${id}`);
        return response as unknown;
    },

    start: async (id: string): Promise<Sprint> => {
        const response = await api.post<Sprint>(`/sprints/${id}/start`);
        return response as unknown as Sprint;
    },

    complete: async (id: string): Promise<Sprint> => {
        const response = await api.post<Sprint>(`/sprints/${id}/complete`);
        return response as unknown as Sprint;
    },

    planningReport: async (id: string): Promise<SprintPlanningReport> => {
        const response = await api.get<{ data: SprintPlanningReport }>(`/sprints/${id}/planning-report`);
        return (response as unknown as { data: SprintPlanningReport }).data;
    },
    savePlanningCapacity: async (id: string, userId: string, data: Record<string, unknown>) => api.put(`/sprints/${id}/planning-capacity/${userId}`, data),
    addPlanningException: async (id: string, data: Record<string, unknown>) => api.post(`/sprints/${id}/planning-exceptions`, data),
    addPlanningHoliday: async (id: string, data: Record<string, unknown>) => api.post(`/sprints/${id}/planning-holidays`, data),
    deletePlanningException: async (id: string, exceptionId: string) => api.delete(`/sprints/${id}/planning-exceptions/${exceptionId}`),
    deletePlanningHoliday: async (id: string, holidayId: string) => api.delete(`/sprints/${id}/planning-holidays/${holidayId}`),
    savePlanningEstimate: async (id: string, workItemId: string, data: Record<string, unknown>) => api.put(`/sprints/${id}/planning-estimates/${workItemId}`, data),
    addPlanningDependency: async (id: string, data: Record<string, unknown>) => api.post(`/sprints/${id}/planning-dependencies`, data),
    deletePlanningDependency: async (id: string, dependencyId: string) => api.delete(`/sprints/${id}/planning-dependencies/${dependencyId}`),
    createPlanningSession: async (id: string, data: Record<string, unknown> = {}) => api.post(`/sprints/${id}/planning-sessions`, data),
    transitionPlanningSession: async (id: string, sessionId: string, status: string) => api.patch(`/sprints/${id}/planning-sessions/${sessionId}`, { status }),
};
