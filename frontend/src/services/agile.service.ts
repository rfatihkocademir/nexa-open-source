import { api } from './api';
import type { Sprint, Story } from '@/types/agile';
import type { ApiResponse } from '@/types/api';

export interface AgileBoardColumn {
    id: string;
    name: string;
    orderIndex: number;
    mappedStatus?: string | null;
    color?: string | null;
    wipLimit?: number | null;
    allowedTransitions?: string[];
    isDefault?: boolean;
    items: Story[];
}

export interface AgileBoardFilters {
    sprintId?: string;
    assigneeId?: string;
    priority?: string;
    itemType?: string;
    search?: string;
}

export interface AgileBoardData {
    columns: AgileBoardColumn[];
    unassignedItems: Story[];
    stories: Story[];
    bugs: Story[];
    activeSprint: Pick<Sprint, 'id' | 'name' | 'goal' | 'startDate' | 'endDate' | 'status'> | null;
}

export interface SprintCompletionStats {
    sprint: Sprint;
    totalItems: number;
    doneItems: number;
    incompleteItems: number;
    incompleteItemsList: Array<{ id: string; title: string; status: string; itemType: string; storyPoints?: number | null }>;
    completionRate: number;
    nextSprints: Array<{ id: string; name: string }>;
}

export const agileService = {
    getBoard: async (projectId: string, filters?: AgileBoardFilters): Promise<AgileBoardData> => {
        const response = (await api.get<ApiResponse<AgileBoardData>>(`/projects/${projectId}/agile/board`, { params: filters })) as unknown as ApiResponse<AgileBoardData>;
        return response.data;
    },

    moveItem: async (type: 'story' | 'bug' | 'task', id: string, status: string): Promise<Story> => {
        const response = (await api.put<ApiResponse<Story>>(`/agile/move/${type}/${id}`, { status })) as unknown as ApiResponse<Story>;
        return response.data;
    },

    getSprintCompletionStats: async (sprintId: string): Promise<SprintCompletionStats> => {
        const response = (await api.get<ApiResponse<SprintCompletionStats>>(`/agile/sprints/${sprintId}/completion-stats`)) as unknown as ApiResponse<SprintCompletionStats>;
        return response.data;
    },

    completeSprint: async (
        sprintId: string,
        incompleteItemsAction: 'MOVE_TO_BACKLOG' | 'MOVE_TO_NEXT_SPRINT',
        nextSprintId?: string
    ): Promise<{ success: boolean; movedItems: number }> => {
        const response = (await api.post<ApiResponse<{ success: boolean; movedItems: number }>>(`/agile/sprints/${sprintId}/complete`, {
            incompleteItemsAction,
            nextSprintId
        })) as unknown as ApiResponse<{ success: boolean; movedItems: number }>;
        return response.data;
    }
};
