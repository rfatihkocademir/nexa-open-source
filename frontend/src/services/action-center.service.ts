import { api } from "@/services/api";
import type {
    ActionCenterItem,
    ActionCenterListParams,
    ActionCenterListResponse,
    ActionCenterSummary,
    BulkUpdateActionCenterItemsInput,
    ConvertActionCenterItemInput,
    ConvertedWorkItem,
    UpdateActionCenterItemInput,
} from "@/types/action-center";

type ApiEnvelope<T> = { data: T };

function unwrap<T>(response: T | ApiEnvelope<T>): T {
    if (response && typeof response === "object" && "data" in response) {
        return (response as ApiEnvelope<T>).data;
    }
    return response as T;
}

export const actionCenterService = {
    list: async (params: ActionCenterListParams): Promise<ActionCenterListResponse> => {
        const response = await api.get<ActionCenterListResponse | ApiEnvelope<ActionCenterListResponse>>("/action-center", { params });
        return unwrap(response as unknown as ActionCenterListResponse | ApiEnvelope<ActionCenterListResponse>);
    },

    summary: async (): Promise<ActionCenterSummary> => {
        const response = await api.get<ActionCenterSummary | ApiEnvelope<ActionCenterSummary>>("/action-center/summary");
        return unwrap(response as unknown as ActionCenterSummary | ApiEnvelope<ActionCenterSummary>);
    },

    reconcile: async (): Promise<ActionCenterSummary> => {
        const response = await api.post<ActionCenterSummary | ApiEnvelope<ActionCenterSummary>>("/action-center/reconcile");
        return unwrap(response as unknown as ActionCenterSummary | ApiEnvelope<ActionCenterSummary>);
    },

    update: async (id: string, input: UpdateActionCenterItemInput): Promise<ActionCenterItem> => {
        const response = await api.patch<ActionCenterItem | ApiEnvelope<ActionCenterItem>>(`/action-center/${encodeURIComponent(id)}`, input);
        return unwrap(response as unknown as ActionCenterItem | ApiEnvelope<ActionCenterItem>);
    },

    bulkUpdate: async (input: BulkUpdateActionCenterItemsInput): Promise<{ updated: number }> => {
        const response = await api.post<{ updated: number } | ApiEnvelope<{ updated: number }>>("/action-center/bulk", input);
        return unwrap(response as unknown as { updated: number } | ApiEnvelope<{ updated: number }>);
    },

    convertToWorkItem: async (id: string, input: ConvertActionCenterItemInput): Promise<ConvertedWorkItem> => {
        const response = await api.post<ConvertedWorkItem | ApiEnvelope<ConvertedWorkItem>>(`/action-center/${encodeURIComponent(id)}/convert-to-work-item`, input);
        return unwrap(response as unknown as ConvertedWorkItem | ApiEnvelope<ConvertedWorkItem>);
    },
};
