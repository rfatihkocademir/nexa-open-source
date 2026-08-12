import { api } from "./api";
import type { Story } from "@/types/agile";

export interface CreateStoryInput {
    title: string;
    description?: string;
    projectId: string;
    itemType?: string;
    status?: string;
    priority?: string;
    points?: number;
    storyPoints?: number;
    acceptanceCriteria?: string;
    assigneeId?: string;
    sprintId?: string;
    epicId?: string;
    parentId?: string;
    requirementId?: string;
    customFields?: Record<string, unknown>;
    workTypeId?: string;
}

export interface StoryFilters {
    status?: string;
    priority?: string;
    sprintId?: string;
    assigneeId?: string;
    epicId?: string;
    itemType?: string;
    search?: string;
}

export const storyService = {
    getAll: async (projectId: string, filters?: StoryFilters, includeDeleted: boolean = false): Promise<Story[]> => {
        const response = await api.get<Story[]>("/stories", { params: { projectId, ...filters, includeDeleted: includeDeleted ? 'true' : undefined } });
        return response as unknown as Story[];
    },

    // The legacy /stories route intentionally returns STORY items only. The
    // backlog also contains activity work item types (MEETING, SUPPORT, ...),
    // so it must use the canonical work-items collection for its listing.
    getAllWorkItems: async (projectId: string, includeDeleted: boolean = false): Promise<Story[]> => {
        const response = await api.get<Story[]>("/work-items", {
            params: { projectId, includeDeleted: includeDeleted ? 'true' : undefined },
        });
        return response as unknown as Story[];
    },

    getById: async (id: string): Promise<Story> => {
        const response = await api.get<Story>(`/stories/${id}`);
        return response as unknown as Story;
    },

    create: async (data: CreateStoryInput): Promise<Story> => {
        const endpointByType: Record<string, string> = {
            STORY: "/stories",
            EPIC: "/epics",
            TASK: "/tasks",
            BUG: "/bugs",
        };
        const response = await api.post<Story>(endpointByType[data.itemType || "STORY"] || "/work-items", data);
        return response as unknown as Story;
    },

    update: async (id: string, data: Partial<Story>): Promise<Story> => {
        const response = await api.patch<Story>(`/stories/${id}`, data);
        return response as unknown as Story;
    },

    delete: async (id: string, hardDelete = false) => {
        const response = await api.delete(`/stories/${id}`, { params: { hardDelete } });
        return response as unknown;
    },

    restore: async (id: string) => {
        const response = await api.patch(`/work-items/${id}/restore`);
        return response as unknown;
    },
};
