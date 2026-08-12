import { api } from './api';
import type { ApiResponse } from '@/types/api';

export type SecurityPolicy = {
    organizationId: string;
    enforceSso: boolean;
    requireMfa: boolean;
    allowedIpRanges: string[];
    sessionIdleMinutes: number;
    sessionMaxMinutes: number;
    auditRetentionDays: number;
    dataResidency: 'TR' | 'EU' | 'GLOBAL';
    updatedAt: string | null;
};

export type ProjectSecurity = {
    id: string;
    key: string;
    name: string;
    status: string;
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    requireExplicitAdminMembership: boolean;
    memberCount: number;
};

export type LegalHold = {
    id: string;
    organizationId: string;
    projectId: string | null;
    projectKey: string | null;
    projectName: string | null;
    title: string;
    reason: string;
    reference: string | null;
    status: 'ACTIVE' | 'RELEASED';
    createdByName: string;
    releasedByName: string | null;
    releaseReason: string | null;
    releasedAt: string | null;
    createdAt: string;
};

export type RetentionPreview = {
    auditRetentionDays: number;
    expiredAuditLogs: number;
    activeHolds: number;
    softDeletedCases: number;
    softDeletedWorkItems: number;
    purgeAllowed: boolean;
    mode: 'PREVIEW_ONLY';
};

const unwrap = <T>(response: unknown): T => (response as ApiResponse<T>).data;

export const enterpriseSecurityService = {
    getPolicy: async () => unwrap<SecurityPolicy>(await api.get('/enterprise/security-policy')),
    updatePolicy: async (input: Omit<SecurityPolicy, 'organizationId' | 'updatedAt'>) => unwrap<SecurityPolicy>(await api.put('/enterprise/security-policy', input)),
    listProjects: async () => unwrap<ProjectSecurity[]>(await api.get('/enterprise/project-security')),
    updateProject: async (id: string, input: Pick<ProjectSecurity, 'dataClassification' | 'requireExplicitAdminMembership'>) =>
        unwrap<ProjectSecurity>(await api.put(`/enterprise/project-security/${encodeURIComponent(id)}`, input)),
    listLegalHolds: async () => unwrap<LegalHold[]>(await api.get('/enterprise/legal-holds')),
    createLegalHold: async (input: { projectId: string | null; title: string; reason: string; reference?: string }) =>
        unwrap<LegalHold>(await api.post('/enterprise/legal-holds', input)),
    releaseLegalHold: async (id: string, reason: string) => unwrap<LegalHold>(await api.post(`/enterprise/legal-holds/${encodeURIComponent(id)}/release`, { reason })),
    retentionPreview: async () => unwrap<RetentionPreview>(await api.get('/enterprise/retention/preview')),
    exportOrganization: async () => await api.get('/enterprise/data-export', { responseType: 'blob' }) as unknown as Blob,
};
