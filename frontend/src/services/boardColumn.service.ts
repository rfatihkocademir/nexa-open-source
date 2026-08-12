import { api } from './api';

export type WorkItemStatus =
    | 'DRAFT' | 'BACKLOG' | 'TODO' | 'OPEN'
    | 'IN_ANALYSIS' | 'IN_PROGRESS' | 'FIXED'
    | 'READY_FOR_TEST' | 'QA' | 'RETEST'
    | 'DONE' | 'CLOSED' | 'REOPENED' | 'WAITING_FOR_INFO';

export interface WorkItemStatusOption {
    value: WorkItemStatus;
    labelKey: string;
    color: string;
}

export const WORK_ITEM_STATUS_OPTIONS: WorkItemStatusOption[] = [
    ...(['DRAFT', 'BACKLOG', 'TODO', 'OPEN', 'IN_ANALYSIS', 'IN_PROGRESS', 'FIXED', 'READY_FOR_TEST', 'QA', 'RETEST', 'DONE', 'CLOSED', 'REOPENED', 'WAITING_FOR_INFO'] as WorkItemStatus[]).map((value, index) => ({
        value,
        labelKey: `agile_board.status_options.${value}`,
        color: ['#94A3B8', '#64748B', '#6B7280', '#3B82F6', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F97316', '#EF4444', '#10B981', '#6B7280', '#F59E0B', '#A855F7'][index],
    })),
];

export interface BoardColumn {
    id: string;
    projectId: string;
    name: string;
    orderIndex: number;
    mappedStatus?: WorkItemStatus | null;
    color?: string | null;
    wipLimit?: number | null;
    allowedTransitions: string[];
    isDefault: boolean;
    _count?: {
        workItems: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface ReorderBoardColumnInput {
    id: string;
    orderIndex: number;
}

export interface CreateBoardColumnInput {
    projectId: string;
    name: string;
    mappedStatus?: WorkItemStatus | null;
    color?: string | null;
    wipLimit?: number | null;
    allowedTransitions?: string[];
}

export interface UpdateBoardColumnInput {
    name?: string;
    mappedStatus?: WorkItemStatus | null;
    color?: string | null;
    wipLimit?: number | null;
    allowedTransitions?: string[];
}

export const boardColumnService = {
    applyTemplate: async (input: {
        projectId: string;
        mode: 'REPLACE' | 'APPEND';
        columns: Array<{
            name: string;
            mappedStatus: WorkItemStatus;
            color: string;
            wipLimit?: number | null;
            allowedTransitionStatuses: WorkItemStatus[];
        }>;
    }): Promise<BoardColumn[]> => {
        const response = await api.post<BoardColumn[]>('/board-columns/apply-template', input);
        return response as unknown as BoardColumn[];
    },
    getByProjectId: async (projectId: string): Promise<BoardColumn[]> => {
        const response = await api.get<BoardColumn[]>(`/board-columns/project/${projectId}`);
        return response as unknown as BoardColumn[];
    },

    create: async (input: CreateBoardColumnInput): Promise<BoardColumn> => {
        const response = await api.post<BoardColumn>('/board-columns', input);
        return response as unknown as BoardColumn;
    },

    update: async (id: string, fields: UpdateBoardColumnInput): Promise<BoardColumn> => {
        const response = await api.put<BoardColumn>(`/board-columns/${id}`, fields);
        return response as unknown as BoardColumn;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/board-columns/${id}`);
    },

    reorder: async (columns: ReorderBoardColumnInput[]): Promise<BoardColumn[]> => {
        const response = await api.post<BoardColumn[]>('/board-columns/reorder', { columns });
        return response as unknown as BoardColumn[];
    }
};
