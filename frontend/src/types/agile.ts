import type { ResultStatus, RunStatus } from "./testRun";

export const StoryStatus = {
    TODO: 'TODO',
    DEVELOPMENT: 'DEVELOPMENT',
    WAITING_FOR_INFO: 'WAITING_FOR_INFO',
    READY_FOR_TEST: 'READY_FOR_TEST',
    IN_TEST: 'IN_TEST',
    DONE: 'DONE'
} as const;
export type StoryStatus = typeof StoryStatus[keyof typeof StoryStatus];

export const StoryPriority = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
} as const;
export type StoryPriority = typeof StoryPriority[keyof typeof StoryPriority];

export const SprintStatus = {
    PLANNED: 'PLANNED',
    ACTIVE: 'ACTIVE',
    CLOSED: 'CLOSED'
} as const;
export type SprintStatus = typeof SprintStatus[keyof typeof SprintStatus];

export const BugRootCause = {
    CODE_DEFECT: 'CODE_DEFECT',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    ENVIRONMENT_ISSUE: 'ENVIRONMENT_ISSUE',
    DATA_ISSUE: 'DATA_ISSUE',
    REQUIREMENT_GAP: 'REQUIREMENT_GAP',
    THIRD_PARTY_FAILURE: 'THIRD_PARTY_FAILURE',
    OTHER: 'OTHER'
} as const;
export type BugRootCause = typeof BugRootCause[keyof typeof BugRootCause];

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
}

export interface Sprint {
    id: string;
    name: string;
    projectId: string;
    startDate: string;
    endDate: string;
    status: SprintStatus;
    goal?: string;
    createdAt: string;
    updatedAt: string;
    capacityPoints?: number | null;
}

export interface Epic {
    id: string;
    title: string;
    description?: string;
    documentationPageId?: string | null;
    projectId: string;
    status: string;
    priority: string;
    _count?: {
        stories: number;
    };
}

export interface GitCommit {
    id: string;
    hash: string;
    message: string;
    authorName: string;
    authorEmail: string;
    url: string;
    date: string;
    projectId: string;
    workItemId?: string;
    createdAt: string;
}

export interface PullRequest {
    id: string;
    prNumber: number;
    title: string;
    state: string;
    url: string;
    author: string;
    projectId: string;
    workItemId?: string;
    mergedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Story {
    id: string;
    key?: string;
    sequenceNumber?: number;
    title: string;
    name?: string;
    description?: string;
    acceptanceCriteria?: string;
    status: StoryStatus | string;
    priority: StoryPriority | string;
    itemType?: 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'DEFECT' | 'INCIDENT' | 'OPERATIONAL' | 'MEETING' | 'PRESENTATION' | 'SUPPORT' | 'ADMINISTRATIVE';
    type?: 'story' | 'bug' | 'task';
    rootCause?: BugRootCause | string;
    points?: number;
    storyPoints?: number;
    projectId: string;
    sprintId?: string | null;
    assigneeId?: string | null;
    assignee?: User | null;
    reporterId?: string | null;
    reporter?: User | null;
    sprint?: Sprint | null;
    epicId?: string | null;
    epic?: Epic | null;
    parentId?: string | null;
    parent?: Story | null;
    children?: Story[];
    documentationPageId?: string | null;
    boardColumnId?: string | null;
    boardOrder?: number | null;
    customFields?: Record<string, any> | null;
    tasks?: Story[];
    bugs?: Story[];
    severity?: string | null;
    testCases?: Array<{
        id: string;
        title: string;
        status: string;
        runItems?: Array<{
            id: string;
            finalStatus: ResultStatus;
            testRunId: string;
            testRun?: {
                id: string;
                title: string;
                status: RunStatus;
                createdAt: string;
            };
        }>;
    }>;
    commits?: GitCommit[];
    pullRequests?: PullRequest[];
    worklogs?: Array<{
        id: string;
        userId: string;
        startedAt: string;
        durationMinutes: number;
        description?: string;
        createdAt: string;
        user: {
            id: string;
            firstName: string;
            lastName: string;
        };
    }>;
    sourceRequestId?: string | null;
    sourceRequest?: {
        id: string;
        title: string;
        status: string;
        releaseCandidates?: Array<{
        id: string;
        title: string;
        status: 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
        readinessScore?: number | null;
        createdAt: string;
    }>;
    };
    _count?: {
        tasks: number;
        bugs: number;
        testCases: number;
    };
    createdAt: string;
    updatedAt: string;
}
