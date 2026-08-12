import { api } from "@/services/api";
import type { Story } from "@/types/agile";

export type WorkItemSearchResult = {
    items: Story[];
    total: number;
    page: number;
    pageSize: number;
    query: string;
};

export const workItemSearchService = {
    search: (projectId: string, q: string, page = 1, pageSize = 500) =>
        api.get<WorkItemSearchResult>("/work-items/search/nql", { params: { projectId, q, page, pageSize } }) as unknown as Promise<WorkItemSearchResult>,
};
