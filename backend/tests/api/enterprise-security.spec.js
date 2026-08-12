const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { securityPolicyService } = require(path.join(__dirname, '../../dist/services/security-policy.service.js'));
const { ProjectAccess } = require(path.join(__dirname, '../../dist/utils/projectAccess.js'));
const { dataGovernanceService } = require(path.join(__dirname, '../../dist/services/data-governance.service.js'));
const { siemService } = require(path.join(__dirname, '../../dist/services/siem.service.js'));
const { encryptString } = require(path.join(__dirname, '../../dist/utils/crypto.js'));
const { auditService } = require(path.join(__dirname, '../../dist/services/audit.service.js'));
const { operationalResilienceService } = require(path.join(__dirname, '../../dist/services/operational-resilience.service.js'));
const AUDIT_SECRET_MARKER = 'must-never-leave-audit-boundary';

test.describe.serial('enterprise security control plane', () => {
  let organization;
  let admin;
  let project;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    organization = await prisma.organization.create({ data: { name: `Security ${suffix}`, slug: `security-${suffix}` } });
    admin = await prisma.user.create({ data: { email: `security-${suffix}@example.com`, password: 'hash', firstName: 'Security', lastName: 'Admin', role: 'ADMIN' } });
    await prisma.organizationMember.create({ data: { organizationId: organization.id, userId: admin.id, isOwner: true } });
    project = await prisma.project.create({ data: { organizationId: organization.id, name: 'Restricted Project', key: `SEC${suffix.slice(-7)}` } });
  });

  test.afterAll(async () => {
    if (organization) await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
    if (admin) await prisma.user.deleteMany({ where: { id: admin.id } });
    await prisma.$disconnect();
  });

  test('returns safe defaults and validates network/session policy', async () => {
    await expect(securityPolicyService.get(organization.id)).resolves.toMatchObject({ enforceSso: false, requireMfa: false, dataResidency: 'TR' });
    await expect(securityPolicyService.update(organization.id, {
      enforceSso: false, requireMfa: false, allowedIpRanges: ['invalid-range'], sessionIdleMinutes: 60,
      sessionMaxMinutes: 1440, auditRetentionDays: 2555, dataResidency: 'TR',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(() => securityPolicyService.assertIpAllowed({ allowedIpRanges: ['10.0.0.0/8'] }, '203.0.113.4')).toThrow(/izin verilmiyor/);
    expect(() => securityPolicyService.assertIpAllowed({ allowedIpRanges: ['10.0.0.0/8'] }, '10.2.3.4')).not.toThrow();
  });

  test('persists organization policy and blocks unsafe SSO/MFA activation', async () => {
    const saved = await securityPolicyService.update(organization.id, {
      enforceSso: false, requireMfa: false, allowedIpRanges: ['10.0.0.0/8'], sessionIdleMinutes: 30,
      sessionMaxMinutes: 480, auditRetentionDays: 2555, dataResidency: 'TR',
    });
    expect(saved).toMatchObject({ sessionIdleMinutes: 30, sessionMaxMinutes: 480, allowedIpRanges: ['10.0.0.0/8'] });
    await expect(securityPolicyService.update(organization.id, { ...saved, allowedIpRanges: [], enforceSso: true })).rejects.toMatchObject({ statusCode: 409 });
    await expect(securityPolicyService.update(organization.id, { ...saved, allowedIpRanges: [], requireMfa: true })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('requires explicit membership even from an administrator on restricted projects', async () => {
    await expect(ProjectAccess.check(project.id, admin.id, 'ADMIN')).resolves.toBe(true);
    await prisma.$executeRaw`UPDATE "Project" SET "dataClassification" = 'RESTRICTED'::"ProjectDataClassification", "requireExplicitAdminMembership" = true WHERE id = ${project.id}`;
    await expect(ProjectAccess.check(project.id, admin.id, 'ADMIN')).rejects.toMatchObject({ statusCode: 403 });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: admin.id } });
    await expect(ProjectAccess.check(project.id, admin.id, 'ADMIN')).resolves.toBe(true);
  });

  test('governs legal hold lifecycle and blocks permanent deletion', async () => {
    const actor = { userId: admin.id, organizationId: organization.id };
    const hold = await dataGovernanceService.createLegalHold(actor, {
      projectId: project.id,
      title: 'Regulatory investigation',
      reason: 'Preserve all project evidence for the external investigation.',
      reference: 'CASE-2026-42',
    });
    expect(hold).toMatchObject({ projectId: project.id, status: 'ACTIVE', reference: 'CASE-2026-42' });
    await expect(dataGovernanceService.assertPermanentDeletionAllowed(project.id)).rejects.toMatchObject({ statusCode: 423 });
    const preview = await dataGovernanceService.retentionPreview(organization.id);
    expect(preview).toMatchObject({ activeHolds: 1, purgeAllowed: false, mode: 'PREVIEW_ONLY' });
    await expect(dataGovernanceService.releaseLegalHold(actor, hold.id, 'Authorized release after evidence preservation completed.')).resolves.toMatchObject({ status: 'RELEASED' });
    await expect(dataGovernanceService.assertPermanentDeletionAllowed(project.id)).resolves.toBeUndefined();
    await expect(dataGovernanceService.releaseLegalHold(actor, hold.id, 'Second release attempt is forbidden.')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('streams a portable export without authentication secrets', async () => {
    await auditService.log({ context: { actorId: admin.id, organizationId: organization.id, projectId: project.id }, entityType: 'SecurityTest', entityId: project.id, action: 'SECURITY_POLICY_VIOLATION', before: { password: AUDIT_SECRET_MARKER }, after: { nested: { refreshToken: AUDIT_SECRET_MARKER }, safe: 'visible' } }, true);
    const auditRecord = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: organization.id, entityType: 'SecurityTest' }, orderBy: { createdAt: 'desc' } });
    expect(auditRecord.before).toEqual({ password: '********' });
    expect(auditRecord.after).toEqual({ nested: { refreshToken: '********' }, safe: 'visible' });
    let exported = '';
    for await (const line of dataGovernanceService.exportOrganization(organization.id, 2)) exported += line;
    const records = exported.trim().split('\n').map((line) => JSON.parse(line));
    expect(records[0]).toMatchObject({ recordType: 'export_manifest', data: { schemaVersion: 1, format: 'NDJSON_GZIP' } });
    expect(records.some((record) => record.recordType === 'organization_member' && record.data.user.email === admin.email)).toBe(true);
    expect(records.some((record) => record.recordType === 'project' && record.data.id === project.id)).toBe(true);
    expect(records.at(-1).recordType).toBe('export_complete');
    expect(exported).toContain('"password":"********"');
    expect(exported).not.toContain('refreshTokenHash');
    expect(exported).not.toContain('clientSecretEncrypted');
    expect(exported).not.toContain(AUDIT_SECRET_MARKER);
  });

  test('creates incidents and persistent SIEM outbox deliveries for security events', async () => {
    process.env.DATA_ENCRYPTION_KEY ||= require('node:crypto').randomBytes(32).toString('base64');
    const destinationId = require('node:crypto').randomUUID();
    await prisma.$executeRaw`INSERT INTO "SiemDestination" (id, "organizationId", name, url, "secretEncrypted", categories, "minimumSeverity", "updatedAt") VALUES (${destinationId}, ${organization.id}, 'Test SIEM', 'https://siem.example.com/events', ${encryptString('test-signing-secret')}, ARRAY['SECURITY']::TEXT[], 'MEDIUM'::"SecuritySeverity", NOW())`;
    const event = await prisma.auditLog.create({ data: { organizationId: organization.id, projectId: project.id, actorId: admin.id, action: 'SECURITY_UNAUTHORIZED_ACCESS', entityType: 'Security', entityId: project.id, after: { attemptedAction: 'project.delete' }, integrityHash: require('node:crypto').randomUUID() } });
    await siemService.onAuditCreated(event);
    const deliveries = await siemService.listDeliveries(organization.id);
    expect(deliveries).toEqual(expect.arrayContaining([expect.objectContaining({ destinationId, action: 'SECURITY_UNAUTHORIZED_ACCESS', status: 'PENDING', severity: 'HIGH' })]));
    const delivery = deliveries.find((item) => item.destinationId === destinationId && item.action === 'SECURITY_UNAUTHORIZED_ACCESS');
    await prisma.$executeRaw`UPDATE "SiemDelivery" SET status = 'DEAD_LETTER'::"SiemDeliveryStatus", attempts = 6 WHERE id = ${delivery.id}`;
    await siemService.retryDelivery(organization.id, delivery.id);
    await expect(siemService.listDeliveries(organization.id)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: delivery.id, status: 'PENDING', attempts: 0 })]));
    const incident = (await siemService.listIncidents(organization.id)).find((item) => item.action === 'SECURITY_UNAUTHORIZED_ACCESS');
    expect(incident).toMatchObject({ status: 'OPEN', severity: 'HIGH', projectId: project.id });
    const actor = { userId: admin.id, organizationId: organization.id };
    await expect(siemService.updateIncident(actor, incident.id, { action: 'ACKNOWLEDGE' })).resolves.toMatchObject({ status: 'ACKNOWLEDGED' });
    await expect(siemService.updateIncident(actor, incident.id, { action: 'RESOLVE', resolution: 'Access attempt was investigated and credentials were revoked.' })).resolves.toMatchObject({ status: 'RESOLVED' });
    await expect(siemService.updateIncident(actor, incident.id, { action: 'REOPEN' })).resolves.toMatchObject({ status: 'OPEN', resolution: null });
    await expect(siemService.updateIncident(actor, incident.id, { action: 'REOPEN' })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('enforces operational targets and records persistent SLO/error budget data', async () => {
    const policy = await operationalResilienceService.updatePolicy(organization.id, {
      availabilityTargetPct: 99.95, latencyP95TargetMs: 500, errorRateTargetPct: 0.5,
      rpoTargetMinutes: 30, rtoTargetMinutes: 60, backupMaxAgeHours: 24,
      maintenanceMode: false, maintenanceMessage: null, maintenanceEndsAt: null,
    });
    expect(policy).toMatchObject({ availabilityTargetPct: 99.95, rpoTargetMinutes: 30, rtoTargetMinutes: 60 });
    await expect(operationalResilienceService.updatePolicy(organization.id, { ...policy, availabilityTargetPct: 100 })).rejects.toMatchObject({ statusCode: 400 });
    operationalResilienceService.record(organization.id, 200, 120);
    operationalResilienceService.record(organization.id, 500, 900);
    await operationalResilienceService.flush();
    await expect(operationalResilienceService.sloReport(organization.id, 1)).resolves.toMatchObject({ totalRequests: 2, serverErrors: 1, status: 'BREACHED', errorBudget: { exhausted: true } });
  });

  test('requires verifiable backup and measured restore evidence', async () => {
    const actor = { userId: admin.id, organizationId: organization.id };
    const base = { status: 'SUCCESS', reference: 'vault://nexa/backup-1', startedAt: new Date(Date.now() - 60_000), completedAt: new Date() };
    await expect(operationalResilienceService.recordEvidence(actor, { ...base, type: 'BACKUP' })).rejects.toMatchObject({ statusCode: 400 });
    await operationalResilienceService.recordEvidence(actor, { ...base, type: 'BACKUP', checksum: 'a'.repeat(64) });
    await expect(operationalResilienceService.recordEvidence(actor, { ...base, type: 'RESTORE_DRILL' })).rejects.toMatchObject({ statusCode: 400 });
    await operationalResilienceService.recordEvidence(actor, { ...base, type: 'RESTORE_DRILL', reference: 'drill://nexa/restore-1', measuredRpoMinutes: 10, measuredRtoMinutes: 20 });
    const readiness = await operationalResilienceService.operationalReadiness(organization.id);
    expect(readiness.recovery).toMatchObject({ backupFresh: true, rpoMet: true, rtoMet: true });
  });
});
