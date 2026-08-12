export interface AIJobStatus {
    kind: 'BUSINESS_REQUEST_ANALYSIS' | 'STORY_TEST_GENERATION';
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    jobId?: string;
    requestedById?: string;
    queuedAt?: string;
    startedAt?: string;
    finishedAt?: string;
    error?: string | null;
    resultSummary?: string | null;
}
