import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';

export type AuditEntry = {
    id: string;
    projectId?: string;
    actorId?: string;
    actor?: { id: string; email: string; firstName: string; lastName: string };
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    createdAt: string;
    integrityHash?: string;
};
export type AuditFilters = {
    search?: string; projectId?: string; actorId?: string; action?: string; entityType?: string; entityId?: string;
    from?: string; to?: string; skip?: number; take?: number;
};
const unwrap = <T>(response: unknown) => (response as ApiResponse<T>).data;

export const auditService = {
    list: async (filters: AuditFilters) =>
        unwrap<{ items: AuditEntry[]; total: number }>(await api.get('/audit-logs', { params: filters })),
    verify: async () =>
        unwrap<{ valid: boolean; checked: number; brokenAt?: string }>(await api.get('/audit-logs/verify')),
    exportCsv: async (filters: AuditFilters) =>
        await api.get('/audit-logs/export', { params: filters, responseType: 'blob' }) as unknown as Blob,
};
