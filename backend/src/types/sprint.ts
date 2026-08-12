import { SprintStatus } from "@prisma/client";

export interface CreateSprintInput {
    name: string;
    goal?: string;
    startDate?: Date;
    endDate?: Date;
    status?: SprintStatus;
    projectId: string;
    capacityPoints?: number;
}

export interface UpdateSprintInput {
    name?: string;
    goal?: string;
    startDate?: Date;
    endDate?: Date;
    status?: SprintStatus;
    capacityPoints?: number | null;
}

export interface SprintFilters {
    status?: SprintStatus;
}
