import type { TestCase } from "./testCase";

export type ResultStatus = 'UNTESTED' | 'PASS' | 'FAIL' | 'RETEST' | 'BLOCK' | 'CONFLICT';
export type RunStatus = 'OPEN' | 'COMPLETED' | 'ARCHIVED';

export interface TestResult {
    id: string;
    runItemId: string;
    status: ResultStatus;
    duration?: number;
    comment?: string;
    evidenceUrl?: string;
    testerId: string;
    createdAt: string;
    stepResults?: { stepIndex: number; status: ResultStatus; comment?: string }[];
}

export interface CaseStepSnapshot {
    action: string;
    expected: string;
    expectedResult?: string;
    name?: string;
}

export type Environment = 'DEV' | 'QA' | 'PREPROD' | 'PROD';

export interface TestRunItem {
    id: string;
    testRunId: string;
    testCaseId: string;
    manualStatus: ResultStatus;
    automationStatus?: ResultStatus;
    finalStatus: ResultStatus;
    assigneeId?: string;
    testCase: TestCase;
    assignee?: {
        firstName: string;
        lastName: string;
    };
    results?: TestResult[];

    // Snapshot Data
    caseTitle?: string;
    caseSteps?: CaseStepSnapshot[];
    casePreconditions?: string;
    casePriority?: string;

    videoUrl?: string;
    errorOutput?: string;
}

export interface TestRun {
    id: string;
    key: string;
    sequenceNumber: number;
    title: string;
    projectId?: string;
    milestoneId?: string;
    creatorId: string;
    status: RunStatus;
    environment: Environment;
    startDate?: string;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
    totalItems: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    untestedCount: number;
    milestone?: {
        name: string;
    };
    creator?: {
        firstName: string;
        lastName: string;
    };
    items?: TestRunItem[];
    _count?: {
        items: number;
    };
}

export interface CreateTestRunInput {
    title: string;
    projectId?: string;
    milestoneId?: string;
    environment?: Environment;
    startDate?: string;
    dueDate?: string;
    includeAllCases?: boolean;
    testCaseIds?: string[];
}

export interface AddResultInput {
    status: ResultStatus;
    duration?: number;
    comment?: string;
    evidenceUrl?: string;
    attachmentIds?: string[];
    stepResults?: { stepIndex: number; status: ResultStatus }[];
}
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ConflictItem {
    id: string;
    caseTitle: string;
    testCase: { title: string };
    manualStatus: ResultStatus;
    automationStatus: ResultStatus;
    finalStatus: ResultStatus;
}

export interface ComparisonReport {
    totalTests: number;
    matched: number;
    conflicts: number;
    manualOnly: number;
    automationOnly: number;
    dualExecution: number;
    matchRate: number;
}

export interface ReportSummaryItem {
    [key: string]: string | number;
    name: string;
    value: number;
    color: string;
}

export interface ReportMetrics {
    totalCases: number;
    passRate: string;
    duration: string;
}

export interface ReportCaseRow {
    id: string;
    title: string;
    status: string;
    duration: string;
    assignee: string;
    error?: string;
}

export interface RunReport {
    id: string;
    summary: ReportSummaryItem[];
    metrics: ReportMetrics;
    cases: ReportCaseRow[];
}
