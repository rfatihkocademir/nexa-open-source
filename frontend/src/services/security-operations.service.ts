import { api } from './api';
import type { ApiResponse } from '@/types/api';

const unwrap = <T>(response: unknown): T => (response as ApiResponse<T>).data;
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SiemDestination = { id: string; name: string; url: string; categories: string[]; minimumSeverity: Severity; isActive: boolean; lastSuccessAt: string | null; lastFailureAt: string | null; consecutiveFailures: number; deliveryCount: number; deadLetterCount: number; pendingCount: number; };
export type SiemDelivery = { id: string; status: 'PENDING' | 'RETRYING' | 'DELIVERED' | 'DEAD_LETTER'; severity: Severity; category: string; attempts: number; nextAttemptAt: string; deliveredAt: string | null; responseCode: number | null; lastError: string | null; createdAt: string; destinationName: string; action: string; entityType: string; entityId: string; };
export type SecurityIncident = { id: string; severity: Severity; status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'; title: string; assignedToId: string | null; assignedToName: string | null; acknowledgedAt: string | null; resolvedAt: string | null; resolution: string | null; createdAt: string; action: string; entityType: string; entityId: string; ip: string | null; userAgent: string | null; integrityHash: string | null; projectId: string | null; };

export const securityOperationsService = {
    listDestinations: async () => unwrap<SiemDestination[]>(await api.get('/enterprise/siem/destinations')),
    createDestination: async (input: { name: string; url: string; categories: string[]; minimumSeverity: Severity }) => unwrap<SiemDestination & { signingSecret: string }>(await api.post('/enterprise/siem/destinations', input)),
    setDestinationActive: async (id: string, isActive: boolean) => { await api.patch(`/enterprise/siem/destinations/${encodeURIComponent(id)}/active`, { isActive }); },
    rotateSecret: async (id: string) => unwrap<{ id: string; signingSecret: string }>(await api.post(`/enterprise/siem/destinations/${encodeURIComponent(id)}/rotate-secret`)),
    listDeliveries: async () => unwrap<SiemDelivery[]>(await api.get('/enterprise/siem/deliveries')),
    retryDelivery: async (id: string) => { await api.post(`/enterprise/siem/deliveries/${encodeURIComponent(id)}/retry`); },
    listIncidents: async () => unwrap<SecurityIncident[]>(await api.get('/enterprise/security-incidents')),
    updateIncident: async (id: string, input: { action: 'ACKNOWLEDGE' | 'RESOLVE' | 'REOPEN'; resolution?: string; assignedToId?: string | null }) => unwrap<SecurityIncident>(await api.patch(`/enterprise/security-incidents/${encodeURIComponent(id)}`, input)),
};
