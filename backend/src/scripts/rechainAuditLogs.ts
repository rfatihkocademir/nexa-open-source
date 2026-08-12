import crypto from 'node:crypto';
import prisma from '../utils/prisma';

const stableJson = (value: unknown): string => JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || item instanceof Date) return item;
    return Object.keys(item as Record<string, unknown>).sort().reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = (item as Record<string, unknown>)[key];
        return sorted;
    }, {});
});

async function main() {
    if (process.env.AUDIT_RECHAIN_CONFIRM !== 'BASELINE_EXISTING_AUDIT_LOGS') {
        throw new Error('Set AUDIT_RECHAIN_CONFIRM=BASELINE_EXISTING_AUDIT_LOGS for the one-time audit baseline operation');
    }
    const key = process.env.AUDIT_SIGNING_KEY || process.env.JWT_SECRET;
    if (!key) throw new Error('AUDIT_SIGNING_KEY or JWT_SECRET is required');
    const records = await prisma.auditLog.findMany({ orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
    const previousByTenant = new Map<string, string | null>();
    for (const record of records) {
        const tenant = record.organizationId || '__system__';
        const previousHash = previousByTenant.get(tenant) || null;
        const canonical = stableJson({
            organizationId: record.organizationId, projectId: record.projectId,
            actorId: record.actorId || 'system', action: record.action, entityType: record.entityType,
            entityId: record.entityId, before: record.before, after: record.after,
            createdAt: record.createdAt.toISOString(), previousHash,
        });
        const integrityHash = crypto.createHmac('sha256', key).update(canonical).digest('hex');
        await prisma.auditLog.update({ where: { id: record.id }, data: { previousHash, integrityHash } });
        previousByTenant.set(tenant, integrityHash);
    }
    console.log(`Rechained ${records.length} audit records`);
}

main().finally(() => prisma.$disconnect());
