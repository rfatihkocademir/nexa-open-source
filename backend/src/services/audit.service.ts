import prisma from '../utils/prisma';
import { createLogger } from '../utils/logger';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { runInBackground } from '../utils/backgroundTask';

const logger = createLogger('AuditService');

const stableJson = (value: unknown): string => JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || item instanceof Date) return item;
    return Object.keys(item as Record<string, unknown>).sort().reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = (item as Record<string, unknown>)[key];
        return sorted;
    }, {});
});
const SECRET_KEY = /password|secret|token|authorization|cookie|api[-_]?key|clientSecret/i;
export const redactSensitive = (value: unknown, key = ''): unknown => {
    if (SECRET_KEY.test(key)) return '********';
    if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, redactSensitive(child, childKey)]));
    }
    return value;
};

export interface AuditContext {
    actorId: string;
    projectId?: string;
    organizationId?: string;
    ip?: string;
    userAgent?: string;
}

export interface LogEntityUpdateParams {
    context: AuditContext;
    entityType: string;
    entityId: string;
    action: string;
    before?: any;
    after?: any;
    reason?: string;
    isAIGenerated?: boolean;
}

export class AuditService {
    /**
     * Generic logging method.
     */
    async log(params: LogEntityUpdateParams, failClosed = process.env.AUDIT_FAIL_CLOSED === 'true') {
        try {
            const beforeData: any = redactSensitive(params.before) || null;
            const redactedAfter = redactSensitive(params.after);
            const afterData: any = redactedAfter && typeof redactedAfter === 'object'
                ? { ...redactedAfter as Record<string, unknown> }
                : redactedAfter || null;

            // Attach metadata to after payload
            if (afterData && typeof afterData === 'object') {
                if (params.reason) afterData._reason = params.reason;
                if (params.isAIGenerated) afterData._isAIGenerated = true;
            }

            const write = () => prisma.$transaction(async (tx) => {
                // The integrity chain is append-only and each record depends on
                // the previous hash. Serialize writers per organization so a
                // burst of concurrent mutations cannot turn an audit conflict
                // into a production 500 when AUDIT_FAIL_CLOSED is enabled.
                const chainLockKey = `audit-chain:${params.context.organizationId || 'global'}`;
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chainLockKey}))`;
                const previous = await tx.auditLog.findFirst({
                    where: { organizationId: params.context.organizationId || null },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    select: { integrityHash: true },
                });
                const createdAt = new Date();
                const canonical = stableJson({
                    organizationId: params.context.organizationId || null, projectId: params.context.projectId || null,
                    actorId: params.context.actorId, action: params.action, entityType: params.entityType,
                    entityId: params.entityId, before: beforeData, after: afterData, createdAt: createdAt.toISOString(),
                    previousHash: previous?.integrityHash || null,
                });
                const integrityHash = crypto.createHmac('sha256', process.env.AUDIT_SIGNING_KEY || process.env.JWT_SECRET as string).update(canonical).digest('hex');
                return tx.auditLog.create({ data: {
                    actorId: params.context.actorId === 'system' ? null : params.context.actorId,
                    projectId: params.context.projectId && params.context.projectId.trim() !== '' ? params.context.projectId : null,
                    organizationId: params.context.organizationId && params.context.organizationId.trim() !== '' ? params.context.organizationId : null,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    before: beforeData,
                    after: afterData,
                    ip: params.context.ip,
                    userAgent: params.context.userAgent,
                    createdAt,
                    previousHash: previous?.integrityHash || null,
                    integrityHash,
                } });
            }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
            let createdAudit: Awaited<ReturnType<typeof write>> | undefined;
            for (let attempt = 1; attempt <= 5; attempt += 1) {
                try {
                    createdAudit = await write();
                    break;
                } catch (error) {
                    const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
                    if (!retryable || attempt === 5) throw error;
                    await new Promise((resolve) => setTimeout(resolve, attempt * 50));
                }
            }
            if (createdAudit) {
                const event = createdAudit;
                runInBackground(
                    () => import('./siem.service').then(({ siemService }) => siemService.onAuditCreated(event)),
                    (error) => logger.error(`Failed to enqueue SIEM event ${event.id}`, error),
                );
            }
        } catch (err) {
            logger.error(`Failed to write audit log for ${params.entityType}:${params.entityId}`, err);
            if (failClosed) throw err;
        }
    }

    /**
     * Helper for entity creation.
     */
    async logCreate(context: AuditContext, entityType: string, entityId: string, data: any, isAIGenerated?: boolean) {
        return this.log({
            context,
            entityType,
            entityId,
            action: `${entityType.toUpperCase()}_CREATE`,
            after: data,
            isAIGenerated,
        });
    }

    /**
     * Helper for entity updates with before/after state.
     */
    async logUpdate(context: AuditContext, entityType: string, entityId: string, before: any, after: any, reason?: string) {
        return this.log({
            context,
            entityType,
            entityId,
            action: `${entityType.toUpperCase()}_UPDATE`,
            before,
            after,
            reason,
        });
    }

    /**
     * Helper for entity deletion.
     */
    async logDelete(context: AuditContext, entityType: string, entityId: string, lastState?: any) {
        return this.log({
            context,
            entityType,
            entityId,
            action: `${entityType.toUpperCase()}_DELETE`,
            before: lastState,
        });
    }

    /**
     * Security audit: logs policy violations, unauthorized access attempts, and gate blocks.
     */
    async logSecurityEvent(
        context: AuditContext,
        eventType: 'POLICY_VIOLATION' | 'UNAUTHORIZED_ACCESS' | 'GATE_BLOCKED' | 'SUSPICIOUS_ACTIVITY',
        details: {
            entityType?: string;
            entityId?: string;
            attemptedAction?: string;
            reason?: string;
            violatedRules?: string[];
        }
    ) {
        return this.log({
            context,
            entityType: details.entityType || 'Security',
            entityId: details.entityId || 'system',
            action: `SECURITY_${eventType}`,
            after: details,
        });
    }

    /**
     * Approval audit: tracks approval/rejection of entities with rationale.
     */
    async logApproval(
        context: AuditContext,
        entityType: string,
        entityId: string,
        decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED',
        rationale?: string
    ) {
        return this.log({
            context,
            entityType,
            entityId,
            action: `${entityType.toUpperCase()}_${decision}`,
            after: { decision, rationale },
            reason: rationale,
        });
    }

    /**
     * Query: Get approval history for an entity.
     */
    async getApprovalHistory(entityType: string, entityId: string) {
        return prisma.auditLog.findMany({
            where: {
                entityType,
                entityId,
                action: {
                    in: [
                        `${entityType.toUpperCase()}_APPROVED`,
                        `${entityType.toUpperCase()}_REJECTED`,
                        `${entityType.toUpperCase()}_REVISION_REQUESTED`,
                    ],
                },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                actor: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        });
    }

    async query(organizationId: string, filters: { projectId?: string; actorId?: string; action?: string; entityType?: string; entityId?: string; search?: string; from?: Date; to?: Date; skip?: number; take?: number }) {
        if (!organizationId) throw new AppError('Denetim günlüğü için kurum kapsamı zorunludur.', 403);
        const search = filters.search?.trim().slice(0, 100);
        const where: Prisma.AuditLogWhereInput = {
            organizationId,
            ...(filters.projectId ? { projectId: filters.projectId } : {}),
            ...(filters.actorId ? { actorId: filters.actorId } : {}),
            ...(filters.action ? { action: filters.action } : {}),
            ...(filters.entityType ? { entityType: filters.entityType } : {}),
            ...(filters.entityId ? { entityId: filters.entityId } : {}),
            ...((filters.from || filters.to) ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
            ...(search ? { OR: [
                { action: { contains: search, mode: 'insensitive' } },
                { entityType: { contains: search, mode: 'insensitive' } },
                { entityId: { contains: search, mode: 'insensitive' } },
                { actor: { is: { OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                ] } } },
            ] } : {}),
        };
        const [items, total] = await prisma.$transaction([
            prisma.auditLog.findMany({ where, skip: filters.skip || 0, take: Math.min(filters.take || 50, 500), orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } } }),
            prisma.auditLog.count({ where }),
        ]);
        return {
            items: items.map((item) => ({ ...item, before: redactSensitive(item.before), after: redactSensitive(item.after), ip: item.ip ? item.ip.replace(/\.\d+$/, '.***') : null, userAgent: undefined })),
            total,
        };
    }

    async verifyChain(organizationId: string) {
        const records = await prisma.auditLog.findMany({ where: { organizationId, integrityHash: { not: null } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        let previousHash: string | null = null;
        for (const record of records) {
            if (record.previousHash !== previousHash || !record.integrityHash) return { valid: false, brokenAt: record.id, checked: records.indexOf(record) };
            const canonical: string = stableJson({
                organizationId: record.organizationId, projectId: record.projectId,
                actorId: record.actorId || 'system', action: record.action, entityType: record.entityType,
                entityId: record.entityId, before: record.before, after: record.after, createdAt: record.createdAt.toISOString(),
                previousHash: record.previousHash,
            });
            const expected: string = crypto.createHmac('sha256', process.env.AUDIT_SIGNING_KEY || process.env.JWT_SECRET as string).update(canonical).digest('hex');
            if (expected !== record.integrityHash) return { valid: false, brokenAt: record.id, checked: records.indexOf(record) };
            previousHash = record.integrityHash;
        }
        return { valid: true, checked: records.length };
    }
}

export const auditService = new AuditService();
