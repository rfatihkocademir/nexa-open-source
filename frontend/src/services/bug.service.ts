import { api } from "./api";
import type { Story } from "@/types/agile";

function unwrap<T>(response: unknown): T {
    if (response && typeof response === "object" && "data" in response) {
        return (response as { data: T }).data;
    }
    return response as T;
}

export interface CreateBugInput {
    title: string;
    description?: string;
    stepsToReproduce?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    projectId: string;
    requirementId?: string;
    storyId?: string;
    testResultId?: string;
    foundInEnv?: 'DEV' | 'QA' | 'PREPROD' | 'PROD';
    rootCause?: string;
    workTypeId?: string;
    customFields?: Record<string, unknown>;
}

export const bugService = {
    create: async (data: CreateBugInput): Promise<Story> => {
        const response = await api.post<Story>("/bugs", data);
        return unwrap<Story>(response);
    },

    getAll: async (projectId: string, includeDeleted = false): Promise<Story[]> => {
        const response = await api.get<Story[]>(`/bugs`, {
            params: { projectId, includeDeleted: includeDeleted ? 'true' : undefined },
        });
        return unwrap<Story[]>(response);
    }
};
