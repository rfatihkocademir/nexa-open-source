
export interface CreateTaskInput {
    title: string;
    description?: string;
    storyId: string;
    assigneeId?: string;
}

export interface UpdateTaskInput {
    title?: string;
    description?: string;
    isCompleted?: boolean;
    assigneeId?: string;
    storyId?: string;
}

export interface TaskFilters {
    storyId?: string;
    assigneeId?: string;
    isCompleted?: boolean;
    projectId?: string;
}
