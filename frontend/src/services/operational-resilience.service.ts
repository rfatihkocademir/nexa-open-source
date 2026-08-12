import { api } from './api';
import type { ApiResponse } from '@/types/api';

export type OperationalPolicy = { organizationId: string; availabilityTargetPct: number; latencyP95TargetMs: number; errorRateTargetPct: number; rpoTargetMinutes: number; rtoTargetMinutes: number; backupMaxAgeHours: number; maintenanceMode: boolean; maintenanceMessage: string | null; maintenanceEndsAt: string | null; updatedAt: string | null };
export type SloReport = { windowDays: number; totalRequests: number; availabilityPct: number | null; errorRatePct: number | null; latencyP95Ms: number | null; status: 'NO_DATA' | 'MEETING' | 'BREACHED'; errorBudget: { consumedPct: number; remainingPct: number; exhausted: boolean } };
export type RecoveryEvidence = { id: string; type: 'BACKUP' | 'RESTORE_DRILL'; status: 'SUCCESS' | 'FAILED'; reference: string; checksum: string | null; completedAt: string; measuredRpoMinutes: number | null; measuredRtoMinutes: number | null; recordedByName: string };
export type OperationalReadiness = { status: 'READY' | 'AT_RISK'; blockers: string[]; infrastructure: { ready: boolean; checks: Record<string, { healthy: boolean; latencyMs: number }> }; policy: OperationalPolicy; slo: SloReport; recovery: { lastBackup: RecoveryEvidence | null; backupAgeHours: number | null; backupFresh: boolean; lastRestoreDrill: RecoveryEvidence | null; rpoMet: boolean; rtoMet: boolean }; security: { siemDeadLetters: number; unsignedAuditLogs: number } };
const unwrap = <T>(response: unknown): T => (response as ApiResponse<T>).data;

export const operationalResilienceService = {
    getPolicy: async () => unwrap<OperationalPolicy>(await api.get('/enterprise/operational-policy')),
    updatePolicy: async (input: Omit<OperationalPolicy, 'organizationId' | 'updatedAt'>) => unwrap<OperationalPolicy>(await api.put('/enterprise/operational-policy', input)),
    readiness: async () => unwrap<OperationalReadiness>(await api.get('/enterprise/operational-readiness')),
    evidence: async () => unwrap<RecoveryEvidence[]>(await api.get('/enterprise/recovery-evidence')),
    createEvidence: async (input: Record<string, unknown>) => unwrap<RecoveryEvidence>(await api.post('/enterprise/recovery-evidence', input)),
};
