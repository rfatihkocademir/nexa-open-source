import { api } from './api';

export const WORK_ITEM_TYPES = ['TASK', 'STORY', 'BUG', 'OPERATIONAL', 'MEETING', 'PRESENTATION', 'SUPPORT', 'ADMINISTRATIVE'] as const;
export type ConfigurableWorkItemType = typeof WORK_ITEM_TYPES[number];

export interface WorkItemPolicy {
    id: string;
    projectId: string;
    itemType: ConfigurableWorkItemType;
    requiresTestsForDone: boolean;
    requiresPassingTest: boolean;
    requiresWorklogForDone: boolean;
    minimumLoggedMinutes: number;
    requiredFields: string[];
}

export const workItemPolicyService = {
    list: async (projectId: string): Promise<WorkItemPolicy[]> => {
        const response = await api.get<WorkItemPolicy[]>(`/work-item-policies/project/${projectId}`);
        return response as unknown as WorkItemPolicy[];
    },
    upsert: async (projectId: string, itemType: ConfigurableWorkItemType, policy: Omit<WorkItemPolicy, 'id' | 'projectId' | 'itemType'>): Promise<WorkItemPolicy> => {
        const response = await api.put<WorkItemPolicy>(`/work-item-policies/project/${projectId}/${itemType}`, policy);
        return response as unknown as WorkItemPolicy;
    },
};
