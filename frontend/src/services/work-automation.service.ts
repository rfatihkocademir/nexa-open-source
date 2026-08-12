import { api } from "@/services/api";

export type WorkAutomationRule = {
    id: string; name: string; description?: string; trigger: string; nqlCondition?: string;
    actions: Array<Record<string, unknown>>; status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
    version: number; executionCount: number; lastExecutedAt?: string;
};
export type WorkAutomationExecution = {
    id: string; ruleId: string; workItemId?: string; status: string; error?: string;
    durationMs?: number; createdAt: string; actionResults?: Array<Record<string, unknown>>;
};
export type AutomationDryRun = {
    matches: boolean;
    workItem: { id: string; key: string; title: string };
    plannedActions: Array<Record<string, unknown>>;
};
export const workAutomationService = {
    list: (projectId: string) => api.get<WorkAutomationRule[]>("/work-automations", { params: { projectId } }) as unknown as Promise<WorkAutomationRule[]>,
    executions: (projectId: string) => api.get<WorkAutomationExecution[]>("/work-automations/executions", { params: { projectId } }) as unknown as Promise<WorkAutomationExecution[]>,
    create: (projectId: string, data: Record<string, unknown>) => api.post<WorkAutomationRule>("/work-automations", { projectId, ...data }) as unknown as Promise<WorkAutomationRule>,
    update: (projectId: string, id: string, data: Record<string, unknown>) => api.patch<WorkAutomationRule>(`/work-automations/${id}`, { projectId, ...data }) as unknown as Promise<WorkAutomationRule>,
    dryRun: (projectId: string, id: string, workItemId: string) => api.post<AutomationDryRun>(`/work-automations/${id}/dry-run`, { projectId, workItemId }) as unknown as Promise<AutomationDryRun>,
    run: (projectId: string, id: string, workItemId: string) => api.post<WorkAutomationExecution>(`/work-automations/${id}/run`, { projectId, workItemId }) as unknown as Promise<WorkAutomationExecution>,
};
