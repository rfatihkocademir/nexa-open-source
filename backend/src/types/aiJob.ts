export type AIJobState = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type AIJobKind = 'BUSINESS_REQUEST_ANALYSIS' | 'STORY_TEST_GENERATION';

export interface AIJobStatus {
  kind: AIJobKind;
  status: AIJobState;
  jobId?: string;
  requestedById?: string;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string | null;
  resultSummary?: string | null;
}
