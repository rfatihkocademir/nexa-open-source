import { api } from "@/services/api";
import type { WorkItemStatus } from "@/services/boardColumn.service";
import type { ConfigurableWorkItemType } from "@/services/workItemPolicy.service";

export type WorkflowRevision = { id: string; version: number; changeNote?: string; createdAt: string; publishedBy: { id: string; firstName: string; lastName: string } };
export type WorkflowColumn = {
    id: string;
    name: string;
    orderIndex: number;
    mappedStatus: WorkItemStatus | null;
    wipLimit: number | null;
    color: string | null;
    allowedTransitions: string[];
};
export type WorkflowPolicy = {
    itemType: ConfigurableWorkItemType;
    requiresTestsForDone: boolean;
    requiresPassingTest: boolean;
    requiresWorklogForDone: boolean;
    minimumLoggedMinutes: number;
    requiredFields: string[];
};
export type WorkflowTransition = {
    id: string;
    name: string;
    fromColumnId: string;
    toColumnId: string;
    itemTypes: ConfigurableWorkItemType[];
    conditions: Array<{ type: 'ROLE_ALLOWED' | 'ASSIGNEE_REQUIRED' | 'PRIORITY_ALLOWED'; values: string[] }>;
    validators: Array<{ type: 'REQUIRED_FIELDS' | 'MIN_WORKLOG' | 'TEST_CASE_REQUIRED'; fields?: string[]; minimumMinutes?: number }>;
    postActions: Array<{ type: 'SET_PRIORITY' | 'ASSIGN_REPORTER' | 'ADD_COMMENT'; value?: string }>;
};
export type WorkflowScheme = {
    id: string; name: string; status: "DRAFT" | "PUBLISHED"; publishedVersion: number;
    draftConfig: { columns: WorkflowColumn[]; policies: WorkflowPolicy[]; transitions: WorkflowTransition[] }; publishedConfig?: object; revisions: WorkflowRevision[];
};
export const workflowSchemeService = {
    get: (projectId: string) => api.get<WorkflowScheme>("/workflow-scheme", { params: { projectId } }) as unknown as Promise<WorkflowScheme>,
    refreshDraft: (projectId: string) => api.post<WorkflowScheme>("/workflow-scheme/draft/from-live", { projectId }) as unknown as Promise<WorkflowScheme>,
    saveDraft: (projectId: string, config: WorkflowScheme["draftConfig"]) => api.put<WorkflowScheme>("/workflow-scheme/draft", { projectId, config }) as unknown as Promise<WorkflowScheme>,
    publish: (projectId: string, changeNote: string) => api.post<WorkflowScheme>("/workflow-scheme/publish", { projectId, changeNote }) as unknown as Promise<WorkflowScheme>,
    restore: (projectId: string, revisionId: string) => api.post<WorkflowScheme>(`/workflow-scheme/revisions/${revisionId}/restore`, { projectId }) as unknown as Promise<WorkflowScheme>,
};
