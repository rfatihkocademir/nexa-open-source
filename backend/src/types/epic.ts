
import { Priority } from "@prisma/client";

export interface CreateEpicInput {
    title: string;
    description?: string;
    priority?: Priority;
    projectId: string;
}

export interface UpdateEpicInput {
    title?: string;
    description?: string;
    status?: string;
    priority?: Priority;
}

export interface EpicFilters {
    status?: string;
    priority?: Priority;
}
