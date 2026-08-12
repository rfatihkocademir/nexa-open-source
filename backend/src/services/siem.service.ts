import axios from 'axios';
import crypto, { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { decryptString, encryptString, randomToken } from '../utils/crypto';
import { createLogger } from '../utils/logger';
import { redactSensitive } from './audit.service';

export type SecuritySeverityName = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
const SEVERITY_RANK: Record<SecuritySeverityName, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const RETRY_MINUTES = [1, 5, 30, 120, 720, 1440];
const logger = createLogger('SiemService');

type AuditEvent = { id: string; organizationId: string | null; projectId: string | null; actorId: string | null; action: string; entityType: string; entityId: string; before: unknown; after: unknown; ip: string | null; userAgent: string | null; createdAt: Date; integrityHash: string | null };

const classify = (event: Pick<AuditEvent, 'action' | 'entityType'>): { category: 'SECURITY' | 'AUDIT'; severity: SecuritySeverityName } => {
    const security = (event.action.startsWith('SECURITY_') && !event.action.startsWith('SECURITY_INCIDENT_')) || event.entityType === 'Security';
    if (!security) return { category: 'AUDIT', severity: event.action.endsWith('_FAILED') ? 'MEDIUM' : 'INFO' };
    if (/SUSPICIOUS|BREACH|TAMPER|CHAIN_INVALID/i.test(event.action)) return { category: 'SECURITY', severity: 'CRITICAL' };
    if (/UNAUTHORIZED|POLICY_VIOLATION|ACCESS_DENIED/i.test(event.action)) return { category: 'SECURITY', severity: 'HIGH' };
    return { category: 'SECURITY', severity: 'MEDIUM' };
};

const assertPublicTarget = async (rawUrl: string) => {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new AppError('SIEM hedef URL geçersiz', 400); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new AppError('SIEM hedefi HTTP veya HTTPS olmalıdır', 400);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new AppError('Üretimde SIEM hedefi HTTPS olmalıdır', 400);
    if (url.username || url.password) throw new AppError('SIEM URL kullanıcı bilgisi içeremez', 400);
    const allowlist = (process.env.SIEM_ALLOWED_DOMAINS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const explicitlyAllowed = allowlist.some((domain) => url.hostname.toLowerCase() === domain || url.hostname.toLowerCase().endsWith(`.${domain}`));
    if (allowlist.length && !explicitlyAllowed) throw new AppError('SIEM hedef alan adı izin listesinde değil', 403);
    const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
    const forbidden = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;
    if (addresses.some(({ address }) => forbidden.test(address)) && !explicitlyAllowed) throw new AppError('Özel ağ SIEM hedefi yalnızca açık alan adı izin listesiyle kullanılabilir', 403);
    return url.toString();
};

export class SiemService {
    async onAuditCreated(event: AuditEvent) {
        if (!event.organizationId) return;
        const { category, severity } = classify(event);
        const destinations = await prisma.$queryRaw<Array<{ id: string; categories: string[]; minimumSeverity: SecuritySeverityName }>>`
            SELECT id, categories, "minimumSeverity"::text FROM "SiemDestination" WHERE "organizationId" = ${event.organizationId} AND "isActive" = true
        `;
        for (const destination of destinations) {
            if (!destination.categories.includes(category) || SEVERITY_RANK[severity] < SEVERITY_RANK[destination.minimumSeverity]) continue;
            await prisma.$executeRaw(Prisma.sql`
                INSERT INTO "SiemDelivery" (id, "destinationId", "auditLogId", status, severity, category, "nextAttemptAt", "updatedAt")
                VALUES (${randomUUID()}, ${destination.id}, ${event.id}, 'PENDING'::"SiemDeliveryStatus", ${severity}::"SecuritySeverity", ${category}, NOW(), NOW())
                ON CONFLICT ("destinationId", "auditLogId") DO NOTHING
            `);
        }
        if (category === 'SECURITY' && SEVERITY_RANK[severity] >= SEVERITY_RANK.MEDIUM) {
            await prisma.$executeRaw(Prisma.sql`
                INSERT INTO "SecurityIncident" (id, "organizationId", "auditLogId", severity, status, title, "updatedAt")
                VALUES (${randomUUID()}, ${event.organizationId}, ${event.id}, ${severity}::"SecuritySeverity", 'OPEN'::"SecurityIncidentStatus", ${event.action.replace(/^SECURITY_/, '').replace(/_/g, ' ')}, NOW())
                ON CONFLICT ("auditLogId") DO NOTHING
            `);
        }
    }

    async createDestination(organizationId: string, input: { name: string; url: string; categories?: string[]; minimumSeverity?: SecuritySeverityName }) {
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (name.length < 3 || name.length > 100) throw new AppError('SIEM hedef adı 3-100 karakter olmalıdır', 400);
        const url = await assertPublicTarget(input.url);
        const categories = Array.from(new Set(input.categories || ['SECURITY'])).filter((value) => ['SECURITY', 'AUDIT'].includes(value));
        if (categories.length === 0) throw new AppError('En az bir SIEM olay kategorisi seçilmelidir', 400);
        const minimumSeverity = input.minimumSeverity || 'MEDIUM';
        if (!(minimumSeverity in SEVERITY_RANK)) throw new AppError('Geçersiz önem seviyesi', 400);
        const signingSecret = randomToken(32);
        const id = randomUUID();
        await prisma.$executeRaw(Prisma.sql`
            INSERT INTO "SiemDestination" (id, "organizationId", name, url, "secretEncrypted", categories, "minimumSeverity", "updatedAt")
            VALUES (${id}, ${organizationId}, ${name}, ${url}, ${encryptString(signingSecret)}, ${categories}, ${minimumSeverity}::"SecuritySeverity", NOW())
        `);
        return { id, name, url, categories, minimumSeverity, isActive: true, signingSecret };
    }

    async listDestinations(organizationId: string) {
        return prisma.$queryRaw(Prisma.sql`
            SELECT d.id, d.name, d.url, d.categories, d."minimumSeverity"::text, d."isActive", d."lastSuccessAt", d."lastFailureAt", d."consecutiveFailures", d."createdAt", d."updatedAt",
                   count(v.id)::int AS "deliveryCount", count(v.id) FILTER (WHERE v.status = 'DEAD_LETTER'::"SiemDeliveryStatus")::int AS "deadLetterCount",
                   count(v.id) FILTER (WHERE v.status IN ('PENDING'::"SiemDeliveryStatus", 'RETRYING'::"SiemDeliveryStatus"))::int AS "pendingCount"
            FROM "SiemDestination" d LEFT JOIN "SiemDelivery" v ON v."destinationId" = d.id
            WHERE d."organizationId" = ${organizationId} GROUP BY d.id ORDER BY d."createdAt" DESC
        `);
    }

    async setDestinationActive(organizationId: string, id: string, isActive: boolean) {
        const affected = await prisma.$executeRaw`UPDATE "SiemDestination" SET "isActive" = ${isActive}, "updatedAt" = NOW() WHERE id = ${id} AND "organizationId" = ${organizationId}`;
        if (affected !== 1) throw new AppError('SIEM hedefi bulunamadı', 404);
    }

    async rotateSecret(organizationId: string, id: string) {
        const signingSecret = randomToken(32);
        const affected = await prisma.$executeRaw`UPDATE "SiemDestination" SET "secretEncrypted" = ${encryptString(signingSecret)}, "updatedAt" = NOW() WHERE id = ${id} AND "organizationId" = ${organizationId}`;
        if (affected !== 1) throw new AppError('SIEM hedefi bulunamadı', 404);
        return { id, signingSecret };
    }

    async listDeliveries(organizationId: string, take = 100) {
        return prisma.$queryRaw(Prisma.sql`
            SELECT v.id, v.status::text, v.severity::text, v.category, v.attempts, v."nextAttemptAt", v."deliveredAt", v."responseCode", v."lastError", v."createdAt",
                   d.id AS "destinationId", d.name AS "destinationName", a.action, a."entityType", a."entityId", a."createdAt" AS "eventCreatedAt"
            FROM "SiemDelivery" v JOIN "SiemDestination" d ON d.id = v."destinationId" JOIN "AuditLog" a ON a.id = v."auditLogId"
            WHERE d."organizationId" = ${organizationId} ORDER BY v."createdAt" DESC LIMIT ${Math.min(Math.max(take, 1), 500)}
        `);
    }

    async retryDelivery(organizationId: string, id: string) {
        const affected = await prisma.$executeRaw(Prisma.sql`
            UPDATE "SiemDelivery" v SET status = 'PENDING'::"SiemDeliveryStatus", attempts = 0, "nextAttemptAt" = NOW(), "lastError" = NULL, "updatedAt" = NOW()
            FROM "SiemDestination" d WHERE v."destinationId" = d.id AND v.id = ${id} AND d."organizationId" = ${organizationId}
              AND v.status = 'DEAD_LETTER'::"SiemDeliveryStatus"
        `);
        if (affected !== 1) throw new AppError('Dead-letter teslimatı bulunamadı', 404);
    }

    async listIncidents(organizationId: string, status?: string): Promise<any[]> {
        return prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT i.id, i.severity::text, i.status::text, i.title, i."assignedToId", i."acknowledgedAt", i."resolvedAt", i.resolution, i."createdAt", i."updatedAt",
                   a.action, a."entityType", a."entityId", a.ip, a."userAgent", a.after, a."integrityHash", a."projectId",
                   CASE WHEN u.id IS NULL THEN NULL ELSE concat(u."firstName", ' ', u."lastName") END AS "assignedToName"
            FROM "SecurityIncident" i JOIN "AuditLog" a ON a.id = i."auditLogId" LEFT JOIN "User" u ON u.id = i."assignedToId"
            WHERE i."organizationId" = ${organizationId} ${status ? Prisma.sql`AND i.status = ${status}::"SecurityIncidentStatus"` : Prisma.empty}
            ORDER BY CASE i.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, i."createdAt" DESC LIMIT 500
        `);
    }

    async updateIncident(actor: { userId: string; organizationId: string }, id: string, input: { action: 'ACKNOWLEDGE' | 'RESOLVE' | 'REOPEN'; resolution?: string; assignedToId?: string | null }) {
        const [current] = await prisma.$queryRaw<Array<{ status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' }>>`
            SELECT status::text FROM "SecurityIncident" WHERE id = ${id} AND "organizationId" = ${actor.organizationId}
        `;
        if (!current) throw new AppError('Güvenlik olayı bulunamadı', 404);
        if (input.action === 'ACKNOWLEDGE' && current.status !== 'OPEN') throw new AppError('Yalnızca açık olay kabul edilebilir', 409);
        if (input.action === 'RESOLVE' && current.status === 'RESOLVED') throw new AppError('Olay zaten çözümlenmiş', 409);
        if (input.action === 'REOPEN' && current.status !== 'RESOLVED') throw new AppError('Yalnızca çözümlenmiş olay yeniden açılabilir', 409);
        if (input.assignedToId) {
            const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: input.assignedToId } }, select: { id: true } });
            if (!member) throw new AppError('Atanan kullanıcı kurum üyesi değil', 400);
        }
        if (input.action === 'RESOLVE' && (typeof input.resolution !== 'string' || input.resolution.trim().length < 10)) throw new AppError('Çözüm açıklaması en az 10 karakter olmalıdır', 400);
        let statement: Prisma.Sql;
        if (input.action === 'ACKNOWLEDGE') statement = Prisma.sql`status = 'ACKNOWLEDGED'::"SecurityIncidentStatus", "acknowledgedById" = ${actor.userId}, "acknowledgedAt" = NOW(), "assignedToId" = COALESCE(${input.assignedToId || null}, "assignedToId")`;
        else if (input.action === 'RESOLVE') statement = Prisma.sql`status = 'RESOLVED'::"SecurityIncidentStatus", "resolvedById" = ${actor.userId}, "resolvedAt" = NOW(), resolution = ${input.resolution!.trim()}, "assignedToId" = COALESCE(${input.assignedToId || null}, "assignedToId")`;
        else statement = Prisma.sql`status = 'OPEN'::"SecurityIncidentStatus", "resolvedById" = NULL, "resolvedAt" = NULL, resolution = NULL`;
        const affected = await prisma.$executeRaw(Prisma.sql`UPDATE "SecurityIncident" SET ${statement}, "updatedAt" = NOW() WHERE id = ${id} AND "organizationId" = ${actor.organizationId}`);
        if (affected !== 1) throw new AppError('Güvenlik olayı bulunamadı', 404);
        return (await this.listIncidents(actor.organizationId)).find((incident: any) => incident.id === id);
    }

    async processDue(limit = 50) {
        const deliveries = await prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT v.*, d.url, d."secretEncrypted", d."organizationId", d."isActive", a.action, a."entityType", a."entityId", a."projectId", a."actorId", a.after, a.before, a.ip, a."userAgent", a."createdAt" AS "eventCreatedAt", a."integrityHash"
            FROM "SiemDelivery" v JOIN "SiemDestination" d ON d.id = v."destinationId" JOIN "AuditLog" a ON a.id = v."auditLogId"
            WHERE v.status IN ('PENDING'::"SiemDeliveryStatus", 'RETRYING'::"SiemDeliveryStatus") AND v."nextAttemptAt" <= NOW() AND d."isActive" = true
            ORDER BY v."nextAttemptAt" ASC LIMIT ${Math.min(Math.max(limit, 1), 200)}
        `);
        for (const delivery of deliveries) await this.deliver(delivery);
        return deliveries.length;
    }

    private async deliver(delivery: any) {
        const payload = { specVersion: '1.0', id: delivery.auditLogId, source: 'nexa.audit', category: delivery.category, severity: delivery.severity, time: delivery.eventCreatedAt, organizationId: delivery.organizationId, projectId: delivery.projectId, actorId: delivery.actorId, action: delivery.action, subject: { type: delivery.entityType, id: delivery.entityId }, data: { before: redactSensitive(delivery.before), after: redactSensitive(delivery.after), ip: delivery.ip, userAgent: delivery.userAgent }, integrityHash: delivery.integrityHash };
        const body = JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = crypto.createHmac('sha256', decryptString(delivery.secretEncrypted)).update(`${timestamp}.${body}`).digest('hex');
        let responseCode: number | null = null;
        let errorMessage: string | null = null;
        try {
            const url = await assertPublicTarget(delivery.url);
            const response = await axios.post(url, body, { timeout: 10_000, maxRedirects: 0, validateStatus: () => true, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Nexa-SIEM/1.0', 'X-Nexa-Event-Id': delivery.auditLogId, 'X-Nexa-Timestamp': timestamp, 'X-Nexa-Signature': `sha256=${signature}` } });
            responseCode = response.status;
            if (response.status < 200 || response.status >= 300) throw new Error(`SIEM endpoint returned HTTP ${response.status}`);
            await prisma.$transaction([
                prisma.$executeRaw`UPDATE "SiemDelivery" SET status = 'DELIVERED'::"SiemDeliveryStatus", attempts = attempts + 1, "deliveredAt" = NOW(), "responseCode" = ${responseCode}, "lastError" = NULL, "updatedAt" = NOW() WHERE id = ${delivery.id}`,
                prisma.$executeRaw`UPDATE "SiemDestination" SET "lastSuccessAt" = NOW(), "consecutiveFailures" = 0, "updatedAt" = NOW() WHERE id = ${delivery.destinationId}`,
            ]);
            return;
        } catch (error) { errorMessage = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown SIEM delivery error'; }
        const nextAttempts = Number(delivery.attempts) + 1;
        const dead = nextAttempts >= RETRY_MINUTES.length;
        const delay = RETRY_MINUTES[Math.min(nextAttempts - 1, RETRY_MINUTES.length - 1)];
        await prisma.$transaction([
            prisma.$executeRaw(Prisma.sql`UPDATE "SiemDelivery" SET status = ${dead ? 'DEAD_LETTER' : 'RETRYING'}::"SiemDeliveryStatus", attempts = ${nextAttempts}, "nextAttemptAt" = NOW() + (${delay} * INTERVAL '1 minute'), "responseCode" = ${responseCode}, "lastError" = ${errorMessage}, "updatedAt" = NOW() WHERE id = ${delivery.id}`),
            prisma.$executeRaw`UPDATE "SiemDestination" SET "lastFailureAt" = NOW(), "consecutiveFailures" = "consecutiveFailures" + 1, "updatedAt" = NOW() WHERE id = ${delivery.destinationId}`,
        ]);
    }
}

export class SiemDeliveryWorker {
    private timer?: NodeJS.Timeout;
    private running = false;
    private async cycle() {
        if (this.running) return;
        this.running = true;
        try { await siemService.processDue(); }
        catch (error) { logger.error('SIEM delivery cycle failed', error); }
        finally { this.running = false; }
    }
    start() { if (this.timer) return; this.timer = setInterval(() => void this.cycle(), 30_000); this.timer.unref(); void this.cycle(); }
    stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}

export const siemService = new SiemService();
export const siemDeliveryWorker = new SiemDeliveryWorker();
