const { test, expect } = require('@playwright/test');
const { getTestRuntime } = require('./helpers/test-runtime');

const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

function uniqueKey(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

test.describe.serial('work item key access', () => {
  let runtime;

  test.afterAll(async () => {
    if (runtime) await runtime.close();
  });

  test('work item detail resolves project scope from the human-readable key', async () => {
    runtime = await getTestRuntime();
    await runtime.prisma.organization.upsert({
      where: { id: DEFAULT_ORGANIZATION_ID },
      update: {},
      create: {
        id: DEFAULT_ORGANIZATION_ID,
        name: 'Default test organization',
        slug: 'default-test-organization',
      },
    });
    const admin = await runtime.upsertUser({
      email: `${uniqueKey('work-item-key').toLowerCase()}@example.com`,
      password: 'Password123!',
      role: 'ADMIN',
      firstName: 'Key',
      lastName: 'Admin',
    });
    const projectKey = uniqueKey('KEY');
    const project = await runtime.prisma.project.create({
      data: {
        name: 'Work item key access project',
        key: projectKey,
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
    const bug = await runtime.prisma.workItem.create({
      data: {
        key: `${projectKey}-1`,
        sequenceNumber: 1,
        projectId: project.id,
        itemType: 'BUG',
        title: 'Key-addressable bug',
        status: 'OPEN',
        priority: 'HIGH',
        severity: 'HIGH',
        stepsToReproduce: 'Open the bug detail page.',
      },
    });

    try {
      const response = await runtime.request('GET', `/api/v1/stories/${encodeURIComponent(bug.key)}`, {
        token: runtime.signToken(admin),
      });

      expect(response.status).toBe(200);
      const body = response.body?.data ?? response.body;
      expect(body.id).toBe(bug.id);
      expect(body.key).toBe(bug.key);
      expect(body.projectId).toBe(project.id);
    } finally {
      await runtime.prisma.project.deleteMany({ where: { id: project.id } });
      await runtime.prisma.user.deleteMany({ where: { id: admin.id } });
    }
  });
});
