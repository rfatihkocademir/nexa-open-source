import type { RunStatus } from "./testRun";

export interface Milestone {
    id: string;
    key: string;
    sequenceNumber: number;
    name: string;
    description?: string;
    dueDate?: string;
    status: RunStatus;
    projectId: string;
    createdAt?: string;
    updatedAt?: string;
    testRuns?: {
        id: string;
        key: string;
        title: string;
        status: RunStatus;
        environment: string;
        createdAt: string;
        items: {
            finalStatus: 'UNTESTED' | 'PASS' | 'FAIL' | 'RETEST' | 'BLOCK' | 'CONFLICT';
        }[];
        _count: {
            items: number;
        };
    }[];
    _count?: {
        testRuns: number;
    };
}

export interface CreateMilestoneInput {
    name: string;
    description?: string;
    dueDate?: string;
    projectId: string;
}

export interface UpdateMilestoneInput {
    name?: string;
    description?: string;
    dueDate?: string;
    status?: RunStatus;
}
