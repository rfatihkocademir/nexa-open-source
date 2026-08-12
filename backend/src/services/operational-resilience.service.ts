import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { isRedisAvailable } from './queue/connection';
import { isMinioAvailable } from './minio.service';
import { AppError } from '../utils/AppError';
import { createLogger } from '../utils/logger';
import { checkAIReadiness } from './aiProvider.service';

const logger = createLogger('OperationalResilience');
const LATENCY_BOUNDS = [100, 250, 500, 1000, 2000, 5000, Number.POSITIVE_INFINITY];
type SloAccumulator = { organizationId: string; bucketStart: Date; total: number; good: number; errors: number; latency: number[] };

export type OperationalPolicyInput = {
    availabilityTargetPct: number;
    latencyP95TargetMs: number;
    errorRateTargetPct: number;
    rpoTargetMinutes: number;
    rtoTargetMinutes: number;
    backupMaxAgeHours: number;
    maintenanceMode: boolean;
    maintenanceMessage?: string | null;
    maintenanceEndsAt?: string | null;
};

const DEFAULT_OPERATIONAL_POLICY: OperationalPolicyInput = { availabilityTargetPct: 99.9, latencyP95TargetMs: 800, errorRateTargetPct: 1, rpoTargetMinutes: 1440, rtoTargetMinutes: 240, backupMaxAgeHours: 26, maintenanceMode: false, maintenanceMessage: null, maintenanceEndsAt: null };
const timed = async (check: () => Promise<boolean>) => { const started = performance.now(); try { const healthy = await check(); return { healthy, latencyMs: Math.round((performance.now() - started) * 10) / 10 }; } catch (error) { return { healthy: false, latencyMs: Math.round((performance.now() - started) * 10) / 10, error: error instanceof Error ? error.message : 'unknown' }; } };

export class OperationalResilienceService {
    private observations = new Map<string, SloAccumulator>();
    private flushTimer?: NodeJS.Timeout;
    private maintenanceCache = new Map<string, { until: number; mode: boolean; message: string | null; endsAt: Date | null }>();

    record(organizationId: string, statusCode: number, durationMs: number) {
        const hour = new Date(); hour.setUTCMinutes(0, 0, 0);
        const key = `${organizationId}:${hour.toISOString()}`;
        const state = this.observations.get(key) || { organizationId, bucketStart: hour, total: 0, good: 0, errors: 0, latency: Array(7).fill(0) };
        state.total += 1;
        if (statusCode < 500) state.good += 1;
        if (statusCode >= 500) state.errors += 1;
        const bucket = LATENCY_BOUNDS.findIndex((bound) => durationMs <= bound);
        state.latency[Math.max(0, bucket)] += 1;
        this.observations.set(key, state);
    }

    start() { if (this.flushTimer) return; this.flushTimer = setInterval(() => void this.flush().catch((error) => logger.error('SLO flush failed', error)), 30_000); this.flushTimer.unref(); }
    async stop() { if (this.flushTimer) clearInterval(this.flushTimer); this.flushTimer = undefined; await this.flush(); }

    async flush() {
        const pending = [...this.observations.values()];
        this.observations.clear();
        for (const item of pending) {
            const b = item.latency;
            try {
                await prisma.$executeRaw(Prisma.sql`
                    INSERT INTO "SloHourlyBucket" (id, "organizationId", "bucketStart", "totalRequests", "goodRequests", "serverErrors", "latencyBuckets", "updatedAt")
                    VALUES (${randomUUID()}, ${item.organizationId}, ${item.bucketStart}, ${item.total}, ${item.good}, ${item.errors}, ${b}, NOW())
                    ON CONFLICT ("organizationId", "bucketStart") DO UPDATE SET
                      "totalRequests" = "SloHourlyBucket"."totalRequests" + EXCLUDED."totalRequests",
                      "goodRequests" = "SloHourlyBucket"."goodRequests" + EXCLUDED."goodRequests",
                      "serverErrors" = "SloHourlyBucket"."serverErrors" + EXCLUDED."serverErrors",
                      "latencyBuckets" = ARRAY[
                        "SloHourlyBucket"."latencyBuckets"[1] + ${b[0]}, "SloHourlyBucket"."latencyBuckets"[2] + ${b[1]},
                        "SloHourlyBucket"."latencyBuckets"[3] + ${b[2]}, "SloHourlyBucket"."latencyBuckets"[4] + ${b[3]},
                        "SloHourlyBucket"."latencyBuckets"[5] + ${b[4]}, "SloHourlyBucket"."latencyBuckets"[6] + ${b[5]},
                        "SloHourlyBucket"."latencyBuckets"[7] + ${b[6]}], "updatedAt" = NOW()
                `);
            } catch (error) {
                const current = this.observations.get(`${item.organizationId}:${item.bucketStart.toISOString()}`);
                if (current) { current.total += item.total; current.good += item.good; current.errors += item.errors; current.latency = current.latency.map((value, index) => value + item.latency[index]); }
                else this.observations.set(`${item.organizationId}:${item.bucketStart.toISOString()}`, item);
                throw error;
            }
        }
    }

    async getPolicy(organizationId: string) {
        const [policy] = await prisma.$queryRaw<any[]>`SELECT "organizationId", "availabilityTargetPct", "latencyP95TargetMs", "errorRateTargetPct", "rpoTargetMinutes", "rtoTargetMinutes", "backupMaxAgeHours", "maintenanceMode", "maintenanceMessage", "maintenanceEndsAt", "updatedAt" FROM "OperationalPolicy" WHERE "organizationId" = ${organizationId}`;
        return policy || { organizationId, ...DEFAULT_OPERATIONAL_POLICY, updatedAt: null };
    }

    async updatePolicy(organizationId: string, input: OperationalPolicyInput) {
        if (!Number.isFinite(input.availabilityTargetPct) || input.availabilityTargetPct < 90 || input.availabilityTargetPct >= 100) throw new AppError('Kullanılabilirlik hedefi 90 ile 100 arasında olmalıdır', 400);
        if (!Number.isInteger(input.latencyP95TargetMs) || input.latencyP95TargetMs < 50 || input.latencyP95TargetMs > 30000) throw new AppError('P95 gecikme hedefi 50-30000 ms olmalıdır', 400);
        if (!Number.isFinite(input.errorRateTargetPct) || input.errorRateTargetPct <= 0 || input.errorRateTargetPct > 10) throw new AppError('Hata oranı hedefi 0-10 arasında olmalıdır', 400);
        for (const [name, value] of [['RPO', input.rpoTargetMinutes], ['RTO', input.rtoTargetMinutes], ['Yedek azami yaşı', input.backupMaxAgeHours]] as const) if (!Number.isInteger(value) || value < 1) throw new AppError(`${name} pozitif tam sayı olmalıdır`, 400);
        const message = input.maintenanceMessage?.trim() || null;
        if (input.maintenanceMode && (!message || message.length < 5)) throw new AppError('Bakım modu için kullanıcı mesajı gereklidir', 400);
        const endsAt = input.maintenanceEndsAt ? new Date(input.maintenanceEndsAt) : null;
        if (endsAt && Number.isNaN(endsAt.getTime())) throw new AppError('Bakım bitiş zamanı geçersiz', 400);
        const [policy] = await prisma.$queryRaw<any[]>(Prisma.sql`
            INSERT INTO "OperationalPolicy" ("organizationId", "availabilityTargetPct", "latencyP95TargetMs", "errorRateTargetPct", "rpoTargetMinutes", "rtoTargetMinutes", "backupMaxAgeHours", "maintenanceMode", "maintenanceMessage", "maintenanceEndsAt", "updatedAt")
            VALUES (${organizationId}, ${input.availabilityTargetPct}, ${input.latencyP95TargetMs}, ${input.errorRateTargetPct}, ${input.rpoTargetMinutes}, ${input.rtoTargetMinutes}, ${input.backupMaxAgeHours}, ${input.maintenanceMode}, ${message}, ${endsAt}, NOW())
            ON CONFLICT ("organizationId") DO UPDATE SET "availabilityTargetPct"=EXCLUDED."availabilityTargetPct", "latencyP95TargetMs"=EXCLUDED."latencyP95TargetMs", "errorRateTargetPct"=EXCLUDED."errorRateTargetPct", "rpoTargetMinutes"=EXCLUDED."rpoTargetMinutes", "rtoTargetMinutes"=EXCLUDED."rtoTargetMinutes", "backupMaxAgeHours"=EXCLUDED."backupMaxAgeHours", "maintenanceMode"=EXCLUDED."maintenanceMode", "maintenanceMessage"=EXCLUDED."maintenanceMessage", "maintenanceEndsAt"=EXCLUDED."maintenanceEndsAt", "updatedAt"=NOW()
            RETURNING *
        `);
        this.maintenanceCache.delete(organizationId);
        return policy;
    }

    async getMaintenance(organizationId: string) {
        const cached = this.maintenanceCache.get(organizationId);
        if (cached && cached.until > Date.now()) return cached;
        const policy = await this.getPolicy(organizationId);
        const endsAt = policy.maintenanceEndsAt ? new Date(policy.maintenanceEndsAt) : null;
        const mode = Boolean(policy.maintenanceMode) && (!endsAt || endsAt > new Date());
        const result = { until: Date.now() + 30_000, mode, message: policy.maintenanceMessage || null, endsAt };
        this.maintenanceCache.set(organizationId, result);
        return result;
    }

    async recordEvidence(actor: { userId: string; organizationId: string }, input: any) {
        if (!['BACKUP', 'RESTORE_DRILL'].includes(input.type) || !['SUCCESS', 'FAILED'].includes(input.status)) throw new AppError('Kanıt tipi veya durumu geçersiz', 400);
        const startedAt = new Date(input.startedAt); const completedAt = new Date(input.completedAt);
        if (Number.isNaN(startedAt.getTime()) || Number.isNaN(completedAt.getTime()) || completedAt < startedAt) throw new AppError('Kanıt zaman aralığı geçersiz', 400);
        const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
        if (reference.length < 3 || reference.length > 500) throw new AppError('Kanıt referansı 3-500 karakter olmalıdır', 400);
        const checksum = typeof input.checksum === 'string' && input.checksum.trim() ? input.checksum.trim() : null;
        if (input.type === 'BACKUP' && input.status === 'SUCCESS' && (!checksum || !/^[a-f0-9]{64}$/i.test(checksum))) throw new AppError('Başarılı yedek kanıtı SHA-256 checksum içermelidir', 400);
        if (input.type === 'RESTORE_DRILL' && input.status === 'SUCCESS' && (!Number.isInteger(input.measuredRpoMinutes) || !Number.isInteger(input.measuredRtoMinutes))) throw new AppError('Başarılı geri yükleme tatbikatı ölçülen RPO ve RTO içermelidir', 400);
        const id = randomUUID();
        const [evidence] = await prisma.$queryRaw<any[]>(Prisma.sql`
            INSERT INTO "RecoveryEvidence" (id, "organizationId", type, status, reference, checksum, "startedAt", "completedAt", "measuredRpoMinutes", "measuredRtoMinutes", notes, "recordedById")
            VALUES (${id}, ${actor.organizationId}, ${input.type}::"RecoveryEvidenceType", ${input.status}::"RecoveryEvidenceStatus", ${reference}, ${checksum}, ${startedAt}, ${completedAt}, ${input.measuredRpoMinutes ?? null}, ${input.measuredRtoMinutes ?? null}, ${typeof input.notes === 'string' ? input.notes.trim().slice(0, 2000) : null}, ${actor.userId}) RETURNING *
        `);
        return evidence;
    }

    async listEvidence(organizationId: string) {
        return prisma.$queryRaw<any[]>`
            SELECT e.*, concat(u."firstName", ' ', u."lastName") AS "recordedByName" FROM "RecoveryEvidence" e JOIN "User" u ON u.id=e."recordedById" WHERE e."organizationId"=${organizationId} ORDER BY e."completedAt" DESC LIMIT 200
        `;
    }

    async sloReport(organizationId: string, days = 30) {
        await this.flush();
        const policy = await this.getPolicy(organizationId);
        const rows = await prisma.$queryRaw<Array<{ total: number; good: number; errors: number; buckets: number[] }>>(Prisma.sql`
            SELECT COALESCE(sum("totalRequests"),0)::int total, COALESCE(sum("goodRequests"),0)::int good, COALESCE(sum("serverErrors"),0)::int errors,
              ARRAY[COALESCE(sum("latencyBuckets"[1]),0)::int,COALESCE(sum("latencyBuckets"[2]),0)::int,COALESCE(sum("latencyBuckets"[3]),0)::int,COALESCE(sum("latencyBuckets"[4]),0)::int,COALESCE(sum("latencyBuckets"[5]),0)::int,COALESCE(sum("latencyBuckets"[6]),0)::int,COALESCE(sum("latencyBuckets"[7]),0)::int] buckets
            FROM "SloHourlyBucket" WHERE "organizationId"=${organizationId} AND "bucketStart" >= NOW() - (${Math.min(Math.max(days, 1), 90)} * INTERVAL '1 day')
        `);
        const row = rows[0] || { total: 0, good: 0, errors: 0, buckets: Array(7).fill(0) };
        const availabilityPct = row.total ? row.good / row.total * 100 : null;
        const errorRatePct = row.total ? row.errors / row.total * 100 : null;
        const targetCount = Math.ceil(row.total * 0.95); let cumulative = 0; let p95: number | null = null;
        row.buckets.forEach((count, index) => { if (p95 === null && (cumulative += count) >= targetCount && row.total > 0) p95 = LATENCY_BOUNDS[index]; });
        const allowedBad = row.total * (1 - policy.availabilityTargetPct / 100);
        const consumedPct = allowedBad > 0 ? Math.max(0, row.errors / allowedBad * 100) : 0;
        return { windowDays: days, totalRequests: row.total, goodRequests: row.good, serverErrors: row.errors, availabilityPct, errorRatePct, latencyP95Ms: p95 === Infinity ? 5000 : p95, targets: { availabilityPct: policy.availabilityTargetPct, errorRatePct: policy.errorRateTargetPct, latencyP95Ms: policy.latencyP95TargetMs }, errorBudget: { allowedBadRequests: Math.floor(allowedBad), consumedPct, remainingPct: Math.max(0, 100 - consumedPct), exhausted: consumedPct >= 100 }, status: row.total === 0 ? 'NO_DATA' : availabilityPct! >= policy.availabilityTargetPct && errorRatePct! <= policy.errorRateTargetPct && (p95 || 0) <= policy.latencyP95TargetMs ? 'MEETING' : 'BREACHED' };
    }

    async infrastructureReadiness() {
        const database = await timed(async () => { await prisma.$queryRaw`SELECT 1`; return true; });
        const migrations = await timed(async () => { const [result] = await prisma.$queryRaw<Array<{ failed: number; unfinished: number }>>`SELECT count(*) FILTER (WHERE logs IS NOT NULL AND finished_at IS NULL AND rolled_back_at IS NULL)::int failed, count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int unfinished FROM _prisma_migrations`; return result.failed === 0 && result.unfinished === 0; });
        const [redis, storage] = await Promise.all([timed(isRedisAvailable), timed(isMinioAvailable)]);
        const aiRequiredSetting = process.env.AI_READINESS_REQUIRED?.trim().toLowerCase();
        const aiRequired = aiRequiredSetting ? aiRequiredSetting === 'true' : process.env.NODE_ENV === 'production';
        const ai = aiRequired ? await timed(async () => (await checkAIReadiness()).healthy) : undefined;
        const ready = database.healthy && migrations.healthy && redis.healthy && storage.healthy && (!aiRequired || Boolean(ai?.healthy));
        return { status: ready ? 'UP' : 'DEGRADED', ready, checks: { database, migrations, redis, storage, ...(aiRequired ? { ai } : {}) }, timestamp: new Date().toISOString() };
    }

    async operationalReadiness(organizationId: string) {
        const [infrastructure, policy, evidence, slo, [siem], [audit]] = await Promise.all([
            this.infrastructureReadiness(), this.getPolicy(organizationId), this.listEvidence(organizationId), this.sloReport(organizationId),
            prisma.$queryRaw<Array<{ deadLetters: number }>>`SELECT count(v.id)::int "deadLetters" FROM "SiemDelivery" v JOIN "SiemDestination" d ON d.id=v."destinationId" WHERE d."organizationId"=${organizationId} AND v.status='DEAD_LETTER'::"SiemDeliveryStatus"`,
            prisma.$queryRaw<Array<{ unsigned: number }>>`SELECT count(*)::int unsigned FROM "AuditLog" WHERE "organizationId"=${organizationId} AND "integrityHash" IS NULL`,
        ]);
        const lastBackup = evidence.find((item) => item.type === 'BACKUP' && item.status === 'SUCCESS') || null;
        const lastDrill = evidence.find((item) => item.type === 'RESTORE_DRILL' && item.status === 'SUCCESS') || null;
        const backupAgeHours = lastBackup ? (Date.now() - new Date(lastBackup.completedAt).getTime()) / 3_600_000 : null;
        const backupFresh = backupAgeHours !== null && backupAgeHours <= policy.backupMaxAgeHours;
        const rpoMet = Boolean(lastDrill && lastDrill.measuredRpoMinutes <= policy.rpoTargetMinutes);
        const rtoMet = Boolean(lastDrill && lastDrill.measuredRtoMinutes <= policy.rtoTargetMinutes);
        const blockers = [!infrastructure.ready && 'Altyapı readiness başarısız', !backupFresh && 'Güncel başarılı yedek kanıtı yok', !lastDrill && 'Başarılı geri yükleme tatbikatı yok', lastDrill && !rpoMet && 'RPO hedefi karşılanmıyor', lastDrill && !rtoMet && 'RTO hedefi karşılanmıyor', siem.deadLetters > 0 && `${siem.deadLetters} SIEM dead-letter var`, audit.unsigned > 0 && `${audit.unsigned} imzasız audit kaydı var`, slo.status === 'BREACHED' && 'SLO hedefi ihlal ediliyor'].filter(Boolean);
        return { status: blockers.length ? 'AT_RISK' : 'READY', blockers, infrastructure, policy, slo, recovery: { lastBackup, backupAgeHours, backupFresh, lastRestoreDrill: lastDrill, rpoMet, rtoMet }, security: { siemDeadLetters: siem.deadLetters, unsignedAuditLogs: audit.unsigned } };
    }
}

export const operationalResilienceService = new OperationalResilienceService();
