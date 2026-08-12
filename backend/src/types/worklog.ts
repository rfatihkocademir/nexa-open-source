export interface CreateWorklogInput {
    startedAt: Date;
    durationMinutes?: number;
    duration?: string;
    description?: string;
    projectId?: string;
    workItemId?: string;
    category?: 'DEVELOPMENT' | 'TESTING' | 'ANALYSIS' | 'OPERATIONS' | 'MEETING' | 'PRESENTATION' | 'SUPPORT' | 'DOCUMENTATION' | 'ADMINISTRATIVE';
    billable?: boolean;
}

export interface UpdateWorklogInput {
    startedAt?: Date;
    durationMinutes?: number;
    duration?: string;
    description?: string;
    category?: CreateWorklogInput['category'];
    billable?: boolean;
}

export interface WorklogFilters {
    userId?: string;
    projectId?: string;
    workItemId?: string;
    from?: string; // Date string iso
    to?: string; // Date string iso
}
