export type ActionCenterStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type ActionCenterSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ActionCenterMode = "mine" | "open" | "critical" | "snoozed";

export interface ActionCenterPerson {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string | null;
}

export interface ActionCenterProject {
    id: string;
    key: string;
    name: string;
}

export interface ActionCenterItem {
    id: string;
    sourceType: string;
    sourceId: string;
    actionType: string;
    title: string;
    description?: string | null;
    severity: ActionCenterSeverity;
    status: ActionCenterStatus;
    dueDate?: string | null;
    snoozedUntil?: string | null;
    actionUrl?: string | null;
    resolution?: string | null;
    resolvedAt?: string | null;
    lastSeenAt: string;
    createdAt: string;
    updatedAt: string;
    project?: ActionCenterProject | null;
    assignee?: ActionCenterPerson | null;
    createdBy?: ActionCenterPerson | null;
    resolvedBy?: ActionCenterPerson | null;
    metadata?: Record<string, unknown> | null;
}

export interface ActionCenterFacets {
    projects?: ActionCenterProject[];
    assignees?: ActionCenterPerson[];
}

export interface ActionCenterListResponse {
    items: ActionCenterItem[];
    total: number;
    page: number;
    totalPages: number;
    facets?: ActionCenterFacets;
}

export interface ActionCenterSummary {
    mine: number;
    open: number;
    critical: number;
    snoozed: number;
    overdue?: number;
    dueSoon?: number;
}

export interface ActionCenterListParams {
    mode?: ActionCenterMode;
    search?: string;
    projectId?: string;
    status?: ActionCenterStatus;
    severity?: ActionCenterSeverity;
    page?: number;
    limit?: number;
}

export interface UpdateActionCenterItemInput {
    status?: ActionCenterStatus;
    assigneeId?: string | null;
    dueDate?: string | null;
    snoozedUntil?: string | null;
    resolution?: string | null;
}

export interface BulkUpdateActionCenterItemsInput extends UpdateActionCenterItemInput {
    ids: string[];
}

export interface ConvertActionCenterItemInput {
    projectId: string;
    title: string;
    description?: string;
    itemType: "OPERATIONAL";
}

export interface ConvertedWorkItem {
    id: string;
    key: string;
    url?: string;
}
