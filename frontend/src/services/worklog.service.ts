import { api } from './api';

export interface Worklog {
    id: string;
    userId: string;
    projectId?: string;
    workItemId?: string;
    startedAt: string;
    durationMinutes: number;
    description?: string;
    category: WorklogCategory;
    billable: boolean;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
    };
    workItem?: {
        id: string;
        title: string;
    };
}

export type WorklogCategory = 'DEVELOPMENT' | 'TESTING' | 'ANALYSIS' | 'OPERATIONS' | 'MEETING' | 'PRESENTATION' | 'SUPPORT' | 'DOCUMENTATION' | 'ADMINISTRATIVE';
export const WORKLOG_CATEGORIES: WorklogCategory[] = ['DEVELOPMENT', 'TESTING', 'ANALYSIS', 'OPERATIONS', 'MEETING', 'PRESENTATION', 'SUPPORT', 'DOCUMENTATION', 'ADMINISTRATIVE'];

export interface CreateWorklogInput {
    startedAt: string;
    durationMinutes: number;
    description?: string;
    projectId?: string;
    workItemId?: string;
    category?: WorklogCategory;
    billable?: boolean;
}

export const worklogService = {
    create: async (data: CreateWorklogInput) => {
        const response = await api.post<Worklog>('/worklogs', data);
        return response as unknown as Worklog;
    },

    getAll: async (filters?: { projectId?: string; workItemId?: string; userId?: string }) => {
        const response = await api.get<Worklog[]>('/worklogs', { params: filters });
        return response as unknown as Worklog[];
    },
    weeklySummary: async (projectId: string, weekStart?: string): Promise<Array<{
        userId: string; name: string; capacityMinutes: number; loggedMinutes: number; remainingMinutes: number; billableMinutes: number; byCategory: Partial<Record<WorklogCategory, number>>;
    }>> => {
        const response = await api.get('/worklogs/weekly-summary', { params: { projectId, weekStart } });
        return response as unknown as Array<{ userId: string; name: string; capacityMinutes: number; loggedMinutes: number; remainingMinutes: number; billableMinutes: number; byCategory: Partial<Record<WorklogCategory, number>> }>;
    },
    
    getTimesheetData: async (projectId: string, startDate: string, endDate: string) => {
        const response = await api.get('/worklogs/timesheet', { params: { projectId, startDate, endDate } });
        return response as unknown as Array<{
            user: { id: string; name: string; };
            totalMinutes: number;
            items: Array<{
                workItem: { id: string; title: string; key: string; itemType: string };
                dailyLogs: Record<string, number>;
                totalMinutes: number;
            }>;
        }>;
    },

    delete: async (id: string) => {
        await api.delete(`/worklogs/${id}`);
    }
};
