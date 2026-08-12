import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { redactSensitive } from './audit.service';

export type LegalHoldRecord = {
    id: string;
    organizationId: string;
    projectId: string | null;
    projectKey: string | null;
    projectName: string | null;
    title: string;
    reason: string;
    reference: string | null;
    status: 'ACTIVE' | 'RELEASED';
    createdById: string;
    createdByName: string;
    releasedById: string | null;
    releasedByName: string | null;
    releaseReason: string | null;
    releasedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

const validateExplanation = (value: unknown, field: string) => {
    if (typeof value !== 'string' || value.trim().length < 10 || value.trim().length > 2000) {
        throw new AppError(`${field} 10-2000 karakter olmalıdır`, 400);
    }
    return value.trim();
};

export class DataGovernanceService {
    async *exportOrganization(organizationId: string, pageSize = 500): AsyncGenerator<string> {
        const encode = (recordType: string, data: unknown) => `${JSON.stringify({ recordType, data }, (_key, value) => typeof value === 'bigint' ? value.toString() : value)}\n`;
        const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true } });
        if (!organization) throw new AppError('Organization not found', 404);
        yield encode('export_manifest', { schemaVersion: 1, generatedAt: new Date().toISOString(), format: 'NDJSON_GZIP', organizationId, excluded: ['passwords', 'session_tokens', 'mfa_secrets', 'oidc_secrets', 'integration_secrets', 'attachment_binaries'] });
        yield encode('organization', organization);
        yield encode('security_policy', await import('./security-policy.service').then(({ securityPolicyService }) => securityPolicyService.get(organizationId)));

        const sources: Array<{ type: string; fetch: (skip: number) => Promise<unknown[]> }> = [
            { type: 'organization_member', fetch: (skip) => prisma.organizationMember.findMany({ where: { organizationId }, skip, take: pageSize, orderBy: { id: 'asc' }, select: { id: true, organizationId: true, userId: true, isOwner: true, createdAt: true, user: { select: { email: true, firstName: true, lastName: true, role: true, isActive: true, emailVerifiedAt: true, mfaEnabled: true, createdAt: true, updatedAt: true } } } }) },
            { type: 'project', fetch: (skip) => prisma.$queryRaw<unknown[]>(Prisma.sql`SELECT p.* FROM "Project" p WHERE p."organizationId" = ${organizationId} ORDER BY p.id ASC LIMIT ${pageSize} OFFSET ${skip}`) },
            { type: 'project_member', fetch: (skip) => prisma.projectMember.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'work_item', fetch: (skip) => prisma.workItem.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'worklog', fetch: (skip) => prisma.worklog.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'test_suite', fetch: (skip) => prisma.testSuite.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'test_case', fetch: (skip) => prisma.testCase.findMany({ where: { suite: { project: { organizationId } } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'test_run', fetch: (skip) => prisma.testRun.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'wiki_space', fetch: (skip) => prisma.wikiSpace.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'wiki_page', fetch: (skip) => prisma.wikiPage.findMany({ where: { space: { project: { organizationId } } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'requirement', fetch: (skip) => prisma.requirement.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'release_candidate', fetch: (skip) => prisma.releaseCandidate.findMany({ where: { project: { organizationId } }, skip, take: pageSize, orderBy: { id: 'asc' } }) },
            { type: 'audit_log', fetch: async (skip) => (await prisma.auditLog.findMany({ where: { organizationId }, skip, take: pageSize, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map((item) => ({ ...item, before: redactSensitive(item.before), after: redactSensitive(item.after), ip: item.ip ? item.ip.replace(/\.\d+$/, '.***') : null, userAgent: undefined })) },
        ];
        for (const source of sources) {
            for (let skip = 0; ; skip += pageSize) {
                const records = await source.fetch(skip);
                for (const record of records) yield encode(source.type, record);
                if (records.length < pageSize) break;
            }
        }
        for (const hold of await this.listLegalHolds(organizationId)) yield encode('legal_hold', hold);
        yield encode('export_complete', { completedAt: new Date().toISOString() });
    }

    async listLegalHolds(organizationId: string, includeReleased = true): Promise<LegalHoldRecord[]> {
        return prisma.$queryRaw<LegalHoldRecord[]>(Prisma.sql`
            SELECT lh.id, lh."organizationId", lh."projectId", p.key AS "projectKey", p.name AS "projectName",
                   lh.title, lh.reason, lh.reference, lh.status::text, lh."createdById",
                   concat(cb."firstName", ' ', cb."lastName") AS "createdByName", lh."releasedById",
                   CASE WHEN rb.id IS NULL THEN NULL ELSE concat(rb."firstName", ' ', rb."lastName") END AS "releasedByName",
                   lh."releaseReason", lh."releasedAt", lh."createdAt", lh."updatedAt"
            FROM "LegalHold" lh
            LEFT JOIN "Project" p ON p.id = lh."projectId"
            JOIN "User" cb ON cb.id = lh."createdById"
            LEFT JOIN "User" rb ON rb.id = lh."releasedById"
            WHERE lh."organizationId" = ${organizationId}
              ${includeReleased ? Prisma.empty : Prisma.sql`AND lh.status = 'ACTIVE'::"LegalHoldStatus"`}
            ORDER BY CASE WHEN lh.status = 'ACTIVE'::"LegalHoldStatus" THEN 0 ELSE 1 END, lh."createdAt" DESC
        `);
    }

    async createLegalHold(actor: { userId: string; organizationId: string }, input: { projectId?: string | null; title: string; reason: string; reference?: string | null }) {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title.length < 3 || title.length > 160) throw new AppError('Legal hold başlığı 3-160 karakter olmalıdır', 400);
        const reason = validateExplanation(input.reason, 'Legal hold gerekçesi');
        const reference = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim().slice(0, 200) : null;
        if (input.projectId) {
            const project = await prisma.project.findFirst({ where: { id: input.projectId, organizationId: actor.organizationId }, select: { id: true } });
            if (!project) throw new AppError('Project not found', 404);
        }
        const id = randomUUID();
        await prisma.$executeRaw(Prisma.sql`
            INSERT INTO "LegalHold" (id, "organizationId", "projectId", title, reason, reference, status, "createdById", "updatedAt")
            VALUES (${id}, ${actor.organizationId}, ${input.projectId || null}, ${title}, ${reason}, ${reference}, 'ACTIVE'::"LegalHoldStatus", ${actor.userId}, NOW())
        `);
        return (await this.listLegalHolds(actor.organizationId)).find((hold) => hold.id === id)!;
    }

    async releaseLegalHold(actor: { userId: string; organizationId: string }, id: string, releaseReasonInput: string) {
        const releaseReason = validateExplanation(releaseReasonInput, 'Kaldırma gerekçesi');
        const affected = await prisma.$executeRaw(Prisma.sql`
            UPDATE "LegalHold" SET status = 'RELEASED'::"LegalHoldStatus", "releasedById" = ${actor.userId},
                   "releaseReason" = ${releaseReason}, "releasedAt" = NOW(), "updatedAt" = NOW()
            WHERE id = ${id} AND "organizationId" = ${actor.organizationId} AND status = 'ACTIVE'::"LegalHoldStatus"
        `);
        if (affected !== 1) throw new AppError('Aktif legal hold bulunamadı', 404);
        return (await this.listLegalHolds(actor.organizationId)).find((hold) => hold.id === id)!;
    }

    async assertPermanentDeletionAllowed(projectId: string) {
        const holds = await prisma.$queryRaw<Array<{ id: string; title: string; projectId: string | null }>>`
            SELECT lh.id, lh.title, lh."projectId" FROM "LegalHold" lh
            JOIN "Project" p ON p."organizationId" = lh."organizationId"
            WHERE p.id = ${projectId} AND lh.status = 'ACTIVE'::"LegalHoldStatus"
              AND (lh."projectId" IS NULL OR lh."projectId" = p.id)
            ORDER BY lh."createdAt" DESC LIMIT 1
        `;
        if (holds[0]) throw new AppError(`Kalıcı silme aktif legal hold nedeniyle engellendi: ${holds[0].title}`, 423);
    }

    async retentionPreview(organizationId: string) {
        const [policy] = await prisma.$queryRaw<Array<{ auditRetentionDays: number }>>`
            SELECT "auditRetentionDays" FROM "OrganizationSecurityPolicy" WHERE "organizationId" = ${organizationId}
        `;
        const auditRetentionDays = policy?.auditRetentionDays ?? 2555;
        const [counts] = await prisma.$queryRaw<Array<{ expiredAuditLogs: number; activeHolds: number; softDeletedCases: number; softDeletedWorkItems: number }>>(Prisma.sql`
            SELECT
              (SELECT count(*)::int FROM "AuditLog" WHERE "organizationId" = ${organizationId} AND "createdAt" < NOW() - (${auditRetentionDays} * INTERVAL '1 day')) AS "expiredAuditLogs",
              (SELECT count(*)::int FROM "LegalHold" WHERE "organizationId" = ${organizationId} AND status = 'ACTIVE'::"LegalHoldStatus") AS "activeHolds",
              (SELECT count(*)::int FROM "TestCase" tc JOIN "TestSuite" ts ON ts.id = tc."suiteId" JOIN "Project" p ON p.id = ts."projectId" WHERE p."organizationId" = ${organizationId} AND tc."deletedAt" IS NOT NULL) AS "softDeletedCases",
              (SELECT count(*)::int FROM "WorkItem" wi JOIN "Project" p ON p.id = wi."projectId" WHERE p."organizationId" = ${organizationId} AND wi."deletedAt" IS NOT NULL) AS "softDeletedWorkItems"
        `);
        return { auditRetentionDays, ...counts, purgeAllowed: counts.activeHolds === 0, mode: 'PREVIEW_ONLY' as const };
    }
}

export const dataGovernanceService = new DataGovernanceService();
