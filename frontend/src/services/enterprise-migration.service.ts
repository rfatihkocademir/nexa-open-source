import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';

export type MigrationSummary = {
    total: number; valid: number; invalid: number; duplicates: number;
    workItems: number; testCases: number; testExecutions?: number; comments?: number; links?: number; sprints?: number;
    create?: number; update?: number; unchanged?: number;
    created?: number; updated?: number; failed?: number;
    labels?: number; hierarchyLinks?: number;
    discoveredUsers?: Array<{ accountId: string; displayName: string }>;
};
export type MigrationJob = {
    id: string;
    source: string;
    status: string;
    summary: MigrationSummary;
    errors?: Array<{ index?: number; key?: string; externalId?: string; message: string }>;
    createdAt: string;
    completedAt?: string;
    _count?: { records: number };
    records?: Array<{ id: string; externalId: string; entityType: string; targetId?: string; status: string; error?: string; updatedAt: string }>;
};
export type DryRunResult = {
    jobId: string;
    summary: MigrationSummary;
    actions: Array<{ externalId: string; sourceKey: string; entityType: string; action: 'CREATE' | 'UPDATE' | 'UNCHANGED'; targetId?: string }>;
};

const unwrap = <T>(response: unknown) => (response as ApiResponse<T>).data;

export const enterpriseMigrationService = {
    list: async (projectId: string) => unwrap<MigrationJob[]>(await api.get('/enterprise-migrations', { params: { projectId } })),
    get: async (projectId: string, jobId: string) => unwrap<MigrationJob>(await api.get(`/enterprise-migrations/${jobId}`, { params: { projectId } })),
    downloadReport: async (projectId: string, jobId: string) => await api.get(`/enterprise-migrations/${jobId}/report`, { params: { projectId }, responseType: 'blob' }) as unknown as Blob,
    analyze: async (projectId: string, payload: unknown, mapping: Record<string, unknown>) =>
        unwrap<MigrationJob>(await api.post('/enterprise-migrations/analyze', { projectId, payload, mapping })),
    testJira: async (projectId: string, integrationId: string) =>
        unwrap<{ connected: boolean; displayName: string; emailAddress?: string }>(await api.post('/enterprise-migrations/jira/test', { projectId, integrationId })),
    analyzeJira: async (projectId: string, integrationId: string, jql: string, maxIssues: number, mapping: Record<string, unknown>) =>
        unwrap<MigrationJob>(await api.post('/enterprise-migrations/jira/analyze', { projectId, integrationId, jql: jql || undefined, maxIssues, mapping })),
    testXray: async (projectId: string, integrationId: string) =>
        unwrap<{ connected: boolean }>(await api.post('/enterprise-migrations/xray/test', { projectId, integrationId })),
    analyzeJiraXray: async (projectId: string, integrationId: string, jql: string, maxIssues: number, mapping: Record<string, unknown>) =>
        unwrap<MigrationJob>(await api.post('/enterprise-migrations/jira-xray/analyze', { projectId, integrationId, jql: jql || undefined, maxIssues, mapping })),
    dryRun: async (projectId: string, jobId: string) =>
        unwrap<DryRunResult>(await api.post(`/enterprise-migrations/${jobId}/dry-run`, { projectId })),
    execute: async (projectId: string, jobId: string) =>
        unwrap<MigrationJob>(await api.post(`/enterprise-migrations/${jobId}/execute`, { projectId })),
};
