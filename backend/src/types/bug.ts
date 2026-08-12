import { BugSeverity, Environment } from "@prisma/client";

export interface CreateBugInput {
    title: string;
    description?: string;
    stepsToReproduce?: string;
    severity?: BugSeverity;
    status?: any;
    projectId: string;
    storyId?: string;
    testResultId?: string;
    foundInEnv?: Environment;
    assigneeId?: string;
}

export interface UpdateBugInput {
    title?: string;
    description?: string;
    stepsToReproduce?: string;
    severity?: BugSeverity;
    status?: any;
    storyId?: string;
    testResultId?: string;
    foundInEnv?: Environment;
    assigneeId?: string;
}

export interface BugFilters {
    status?: any;
    severity?: BugSeverity;
    storyId?: string;
    assigneeId?: string;
    testResultId?: string;
}
