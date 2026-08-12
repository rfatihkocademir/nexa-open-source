import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { encryptString, hashToken, randomToken } from '../utils/crypto';
import { getAuditContext } from '../utils/requestContext';
import { auditService } from '../services/audit.service';
import { securityPolicyService, type SecurityPolicyInput } from '../services/security-policy.service';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';
import { dataGovernanceService } from '../services/data-governance.service';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { siemService, type SecuritySeverityName } from '../services/siem.service';
import { operationalResilienceService, type OperationalPolicyInput } from '../services/operational-resilience.service';

const DATA_RESIDENCIES = ['TR', 'EU', 'GLOBAL'] as const;
const PROJECT_CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;

export const enterpriseController = {
    async getOperationalPolicy(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await operationalResilienceService.getPolicy(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async updateOperationalPolicy(req: Request, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId!;
            const before = await operationalResilienceService.getPolicy(organizationId);
            const policy = await operationalResilienceService.updatePolicy(organizationId, req.body as OperationalPolicyInput);
            await auditService.log({ context: getAuditContext(req), entityType: 'OperationalPolicy', entityId: organizationId, action: 'OPERATIONAL_POLICY_UPDATE', before, after: policy }, true);
            return res.json({ success: true, data: policy });
        } catch (error) { return next(error); }
    },
    async operationalReadiness(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await operationalResilienceService.operationalReadiness(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async sloReport(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await operationalResilienceService.sloReport(req.user!.organizationId!, Number(req.query.days) || 30) }); }
        catch (error) { return next(error); }
    },
    async listRecoveryEvidence(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await operationalResilienceService.listEvidence(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async createRecoveryEvidence(req: Request, res: Response, next: NextFunction) {
        try {
            const evidence = await operationalResilienceService.recordEvidence({ userId: req.user!.id, organizationId: req.user!.organizationId! }, req.body);
            await auditService.log({ context: getAuditContext(req), entityType: 'RecoveryEvidence', entityId: evidence.id, action: 'RECOVERY_EVIDENCE_CREATE', after: evidence }, true);
            return res.status(201).json({ success: true, data: evidence });
        } catch (error) { return next(error); }
    },
    async listSiemDestinations(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await siemService.listDestinations(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async createSiemDestination(req: Request, res: Response, next: NextFunction) {
        try {
            const destination = await siemService.createDestination(req.user!.organizationId!, { ...req.body, minimumSeverity: req.body.minimumSeverity as SecuritySeverityName });
            await auditService.log({ context: getAuditContext(req), entityType: 'SiemDestination', entityId: destination.id, action: 'SIEM_DESTINATION_CREATE', after: { ...destination, signingSecret: undefined } }, true);
            return res.status(201).json({ success: true, data: destination, message: 'İmzalama anahtarı yalnızca bir kez gösterilir' });
        } catch (error) { return next(error); }
    },
    async setSiemDestinationActive(req: Request, res: Response, next: NextFunction) {
        try {
            if (typeof req.body.isActive !== 'boolean') throw new AppError('isActive boolean olmalıdır', 400);
            await siemService.setDestinationActive(req.user!.organizationId!, req.params.id, req.body.isActive);
            await auditService.log({ context: getAuditContext(req), entityType: 'SiemDestination', entityId: req.params.id, action: req.body.isActive ? 'SIEM_DESTINATION_ENABLE' : 'SIEM_DESTINATION_DISABLE', after: { isActive: req.body.isActive } }, true);
            return res.status(204).send();
        } catch (error) { return next(error); }
    },
    async rotateSiemSecret(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await siemService.rotateSecret(req.user!.organizationId!, req.params.id);
            await auditService.log({ context: getAuditContext(req), entityType: 'SiemDestination', entityId: req.params.id, action: 'SIEM_SECRET_ROTATE', after: { rotated: true } }, true);
            return res.json({ success: true, data: result, message: 'Yeni anahtar yalnızca bir kez gösterilir' });
        } catch (error) { return next(error); }
    },
    async listSiemDeliveries(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await siemService.listDeliveries(req.user!.organizationId!, Number(req.query.take) || 100) }); }
        catch (error) { return next(error); }
    },
    async retrySiemDelivery(req: Request, res: Response, next: NextFunction) {
        try { await siemService.retryDelivery(req.user!.organizationId!, req.params.id); return res.status(204).send(); }
        catch (error) { return next(error); }
    },
    async listSecurityIncidents(req: Request, res: Response, next: NextFunction) {
        try {
            const status = typeof req.query.status === 'string' ? req.query.status : undefined;
            if (status && !['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) throw new AppError('Geçersiz olay durumu', 400);
            return res.json({ success: true, data: await siemService.listIncidents(req.user!.organizationId!, status) });
        }
        catch (error) { return next(error); }
    },
    async updateSecurityIncident(req: Request, res: Response, next: NextFunction) {
        try {
            if (!['ACKNOWLEDGE', 'RESOLVE', 'REOPEN'].includes(req.body.action)) throw new AppError('Geçersiz olay aksiyonu', 400);
            const incident = await siemService.updateIncident({ userId: req.user!.id, organizationId: req.user!.organizationId! }, req.params.id, req.body);
            await auditService.log({ context: getAuditContext(req, incident?.projectId || undefined), entityType: 'SecurityIncident', entityId: req.params.id, action: `SECURITY_INCIDENT_${req.body.action}`, after: incident, reason: req.body.resolution }, true);
            return res.json({ success: true, data: incident });
        } catch (error) { return next(error); }
    },
    async listLegalHolds(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await dataGovernanceService.listLegalHolds(req.user!.organizationId!, req.query.includeReleased !== 'false') }); }
        catch (error) { return next(error); }
    },
    async createLegalHold(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = { userId: req.user!.id, organizationId: req.user!.organizationId! };
            const hold = await dataGovernanceService.createLegalHold(actor, req.body);
            await auditService.log({ context: getAuditContext(req, hold.projectId || undefined), entityType: 'LegalHold', entityId: hold.id, action: 'LEGAL_HOLD_CREATE', after: hold, reason: hold.reason }, true);
            return res.status(201).json({ success: true, data: hold });
        } catch (error) { return next(error); }
    },
    async releaseLegalHold(req: Request, res: Response, next: NextFunction) {
        try {
            const actor = { userId: req.user!.id, organizationId: req.user!.organizationId! };
            const before = (await dataGovernanceService.listLegalHolds(actor.organizationId)).find((hold) => hold.id === req.params.id);
            if (!before || before.status !== 'ACTIVE') throw new AppError('Aktif legal hold bulunamadı', 404);
            const hold = await dataGovernanceService.releaseLegalHold(actor, req.params.id, req.body.reason);
            await auditService.log({ context: getAuditContext(req, hold.projectId || undefined), entityType: 'LegalHold', entityId: hold.id, action: 'LEGAL_HOLD_RELEASE', before, after: hold, reason: hold.releaseReason || undefined }, true);
            return res.json({ success: true, data: hold });
        } catch (error) { return next(error); }
    },
    async retentionPreview(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await dataGovernanceService.retentionPreview(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async exportOrganization(req: Request, res: Response, next: NextFunction) {
        const organizationId = req.user!.organizationId!;
        const context = getAuditContext(req);
        const exportId = `organization-export-${Date.now()}`;
        try {
            await auditService.log({ context, entityType: 'OrganizationExport', entityId: exportId, action: 'ORGANIZATION_EXPORT_START', after: { format: 'NDJSON_GZIP' } }, true);
            const filename = `nexa-kurum-verisi-${new Date().toISOString().slice(0, 10)}.ndjson.gz`;
            res.status(200);
            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            await pipeline(Readable.from(dataGovernanceService.exportOrganization(organizationId)), createGzip({ level: 6 }), res);
            await auditService.log({ context, entityType: 'OrganizationExport', entityId: exportId, action: 'ORGANIZATION_EXPORT_COMPLETE', after: { format: 'NDJSON_GZIP' } }, true);
        } catch (error) {
            if (res.headersSent) {
                res.destroy(error instanceof Error ? error : undefined);
                return;
            }
            return next(error);
        }
    },
    async getSecurityPolicy(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await securityPolicyService.get(req.user!.organizationId!) }); }
        catch (error) { return next(error); }
    },
    async updateSecurityPolicy(req: Request, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId!;
            const before = await securityPolicyService.get(organizationId);
            const body = req.body as Partial<SecurityPolicyInput>;
            if (typeof body.enforceSso !== 'boolean' || typeof body.requireMfa !== 'boolean' || !Array.isArray(body.allowedIpRanges)
                || typeof body.sessionIdleMinutes !== 'number' || typeof body.sessionMaxMinutes !== 'number'
                || typeof body.auditRetentionDays !== 'number' || !DATA_RESIDENCIES.includes(body.dataResidency as typeof DATA_RESIDENCIES[number])) {
                throw new AppError('Güvenlik politikası alanları eksik veya geçersiz', 400);
            }
            securityPolicyService.assertIpAllowed(body as SecurityPolicyInput, getAuditContext(req).ip);
            const policy = await securityPolicyService.update(organizationId, body as SecurityPolicyInput);
            await auditService.log({ context: getAuditContext(req), entityType: 'OrganizationSecurityPolicy', entityId: organizationId, action: 'SECURITY_POLICY_UPDATE', before, after: policy }, true);
            return res.json({ success: true, data: policy, message: 'Politika kaydedildi; etkin oturumlar güvenlik nedeniyle sonlandırıldı' });
        } catch (error) { return next(error); }
    },
    async listProjectSecurity(req: Request, res: Response, next: NextFunction) {
        try {
            const projects = await prisma.$queryRaw`
                SELECT p.id, p.key, p.name, p.status::text, p."dataClassification"::text, p."requireExplicitAdminMembership", COUNT(pm.id)::int AS "memberCount"
                FROM "Project" p LEFT JOIN "ProjectMember" pm ON pm."projectId" = p.id
                WHERE p."organizationId" = ${req.user!.organizationId!}
                GROUP BY p.id ORDER BY p.name ASC
            `;
            return res.json({ success: true, data: projects });
        } catch (error) { return next(error); }
    },
    async updateProjectSecurity(req: Request, res: Response, next: NextFunction) {
        try {
            const organizationId = req.user!.organizationId!;
            const classification = req.body.dataClassification as typeof PROJECT_CLASSIFICATIONS[number];
            if (!PROJECT_CLASSIFICATIONS.includes(classification) || typeof req.body.requireExplicitAdminMembership !== 'boolean') throw new AppError('Proje güvenlik alanları geçersiz', 400);
            const [before] = await prisma.$queryRaw<Array<{ id: string; dataClassification: string; requireExplicitAdminMembership: boolean }>>`
                SELECT id, "dataClassification"::text, "requireExplicitAdminMembership" FROM "Project" WHERE id = ${req.params.id} AND "organizationId" = ${organizationId}
            `;
            if (!before) throw new AppError('Project not found', 404);
            const [project] = await prisma.$queryRaw<Array<{ id: string; key: string; name: string; dataClassification: string; requireExplicitAdminMembership: boolean }>>(Prisma.sql`
                UPDATE "Project" SET "dataClassification" = ${classification}::"ProjectDataClassification", "requireExplicitAdminMembership" = ${req.body.requireExplicitAdminMembership}, "updatedAt" = NOW()
                WHERE id = ${before.id} RETURNING id, key, name, "dataClassification"::text, "requireExplicitAdminMembership"
            `);
            await auditService.log({ context: getAuditContext(req, project.id), entityType: 'ProjectSecurity', entityId: project.id, action: 'PROJECT_SECURITY_UPDATE', before, after: project }, true);
            return res.json({ success: true, data: project });
        } catch (error) { return next(error); }
    },
    async createScimToken(req: Request, res: Response, next: NextFunction) {
        try {
            const rawToken = randomToken(48);
            const record = await prisma.scimToken.create({ data: { organizationId: req.user!.organizationId!, name: req.body.name, tokenHash: hashToken(rawToken), expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null } });
            await auditService.log({ context: getAuditContext(req), entityType: 'ScimToken', entityId: record.id, action: 'SCIM_TOKEN_CREATE', after: { name: record.name, expiresAt: record.expiresAt } }, true);
            return res.status(201).json({ success: true, data: { id: record.id, token: rawToken, name: record.name, expiresAt: record.expiresAt }, message: 'Store this token now; it will not be shown again' });
        } catch (error) { return next(error); }
    },
    async listScimTokens(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await prisma.scimToken.findMany({ where: { organizationId: req.user!.organizationId! }, select: { id: true, name: true, expiresAt: true, lastUsedAt: true, revokedAt: true, createdAt: true } }) }); }
        catch (error) { return next(error); }
    },
    async revokeScimToken(req: Request, res: Response, next: NextFunction) {
        try { await prisma.scimToken.updateMany({ where: { id: req.params.id, organizationId: req.user!.organizationId! }, data: { revokedAt: new Date() } }); return res.status(204).send(); }
        catch (error) { return next(error); }
    },
    async createOidcProvider(req: Request, res: Response, next: NextFunction) {
        try {
            const provider = await prisma.oidcProvider.create({ data: { organizationId: req.user!.organizationId!, name: req.body.name, issuer: req.body.issuer, clientId: req.body.clientId, clientSecretEncrypted: encryptString(req.body.clientSecret), scopes: req.body.scopes || 'openid email profile', allowedDomains: req.body.allowedDomains || [] } });
            return res.status(201).json({ success: true, data: { ...provider, clientSecretEncrypted: undefined } });
        } catch (error) { return next(error); }
    },
    async listOidcProviders(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await prisma.oidcProvider.findMany({ where: { organizationId: req.user!.organizationId! }, select: { id: true, name: true, issuer: true, clientId: true, scopes: true, allowedDomains: true, isActive: true, createdAt: true, updatedAt: true } }) }); }
        catch (error) { return next(error); }
    },
};
