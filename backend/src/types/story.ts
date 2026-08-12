import { Priority } from "@prisma/client";

export interface CreateStoryInput {
    title: string;
    description?: string;
    acceptanceCriteria?: string;
    storyPoints?: number;
    priority?: Priority;
    status?: any;
    projectId: string;
    epicId?: string;
    sprintId?: string;
    assigneeId?: string;
}

export interface UpdateStoryInput {
    title?: string;
    description?: string;
    acceptanceCriteria?: string;
    storyPoints?: number;
    priority?: Priority;
    status?: any;
    epicId?: string;
    sprintId?: string;
    assigneeId?: string;
}

export interface StoryFilters {
    status?: any;
    sprintId?: string;
    epicId?: string;
    assigneeId?: string;
}
