const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { workAutomationService } = require(path.join(__dirname, '../../dist/services/work-automation.service.js'));

test.describe.serial('work management automation', () => {
  let user;
  let project;
  let item;
  let rule;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    user = await prisma.user.create({ data: { email: `rule-${suffix}@example.com`, password: 'test-hash', firstName: 'Rule', lastName: 'Owner', role: 'ADMIN' } });
    project = await prisma.project.create({ data: { name: `Automation ${suffix}`, key: `A${suffix.replace(/\D/g, '').slice(-7)}` } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } });
    item = await prisma.workItem.create({ data: { key: `${project.key}-1`, sequenceNumber: 1, projectId: project.id, itemType: 'BUG', title: 'Checkout failure', status: 'OPEN', priority: 'HIGH', severity: 'CRITICAL' } });
  });

  test.afterAll(async () => {
    if (project) await prisma.project.deleteMany({ where: { id: project.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('validates, dry-runs and executes NQL based actions', async () => {
    rule = await workAutomationService.create(project.id, user.id, {
      name: 'Escalate critical bugs',
      trigger: 'WORK_ITEM_CREATED',
      nqlCondition: 'type = BUG AND severity = CRITICAL',
      actions: [
        { type: 'SET_PRIORITY', priority: 'CRITICAL' },
        { type: 'ADD_COMMENT', body: 'Critical bug automation applied.' },
      ],
    });
    await workAutomationService.update(project.id, rule.id, user.id, { status: 'ACTIVE' });
    await expect(workAutomationService.dryRun(project.id, rule.id, item.id, user.id)).resolves.toMatchObject({ matches: true });

    const first = await workAutomationService.dispatch('WORK_ITEM_CREATED', project.id, item.id, user.id, 'event-1');
    const duplicate = await workAutomationService.dispatch('WORK_ITEM_CREATED', project.id, item.id, user.id, 'event-1');
    expect(first[0].status).toBe('SUCCEEDED');
    expect(duplicate[0].id).toBe(first[0].id);
    await expect(prisma.workItem.findUnique({ where: { id: item.id } })).resolves.toMatchObject({ priority: 'CRITICAL' });
    expect(await prisma.comment.count({ where: { workItemId: item.id } })).toBe(1);
  });

  test('records skipped executions when the NQL condition does not match', async () => {
    await prisma.workItem.update({ where: { id: item.id }, data: { severity: 'LOW' } });
    const result = await workAutomationService.dispatch('WORK_ITEM_CREATED', project.id, item.id, user.id, 'event-2');
    expect(result[0].status).toBe('SKIPPED');
  });
});
