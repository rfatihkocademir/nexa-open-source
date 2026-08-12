const path = require('node:path');
const { test, expect } = require('@playwright/test');
const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { auditService } = require(path.join(__dirname, '../../dist/services/audit.service.js'));

test.describe.serial('enterprise audit management', () => {
  let organization;
  let user;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    organization = await prisma.organization.create({ data: { name: `Audit ${suffix}`, slug: `audit-${suffix}` } });
    user = await prisma.user.create({ data: { email: `audit-${suffix}@example.com`, password: 'hash', firstName: 'Audit', lastName: 'Admin', role: 'ADMIN' } });
    await prisma.organizationMember.create({ data: { organizationId: organization.id, userId: user.id } });
  });

  test.afterAll(async () => {
    if (organization) await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('filters records, redacts secrets and verifies the integrity chain', async () => {
    await auditService.log({
      context: { organizationId: organization.id, actorId: user.id, ip: '192.0.2.42', userAgent: 'test-agent' },
      entityType: 'Integration', entityId: 'jira-1', action: 'INTEGRATION_UPDATE',
      after: { name: 'Jira', apiToken: 'must-not-leak', nested: { clientSecret: 'also-secret' } },
    }, true);
    const result = await auditService.query(organization.id, { search: 'jira', take: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].after).toMatchObject({ apiToken: '********', nested: { clientSecret: '********' } });
    expect(result.items[0].ip).toBe('192.0.2.***');
    expect(result.items[0].userAgent).toBeUndefined();
    await expect(auditService.verifyChain(organization.id)).resolves.toMatchObject({ valid: true, checked: 1 });
  });

  test('refuses an unscoped audit query', async () => {
    await expect(auditService.query('', {})).rejects.toThrow(/kurum kapsamı zorunludur/i);
  });
});
