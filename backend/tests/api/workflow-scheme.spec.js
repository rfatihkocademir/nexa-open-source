const path = require('node:path');
const { test, expect } = require('@playwright/test');
const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { workflowSchemeService } = require(path.join(__dirname, '../../dist/services/workflow-scheme.service.js'));
const { AgileService } = require(path.join(__dirname, '../../dist/services/agile.service.js'));

test.describe.serial('workflow draft and version publishing', () => {
  let user;
  let project;
  let firstColumn;
  let secondColumn;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    user = await prisma.user.create({ data: { email: `workflow-${suffix}@example.com`, password: 'hash', firstName: 'Workflow', lastName: 'Owner', role: 'ADMIN' } });
    project = await prisma.project.create({ data: { name: `Workflow ${suffix}`, key: `W${suffix.replace(/\D/g, '').slice(-7)}` } });
    firstColumn = await prisma.boardColumn.create({ data: { projectId: project.id, name: 'Todo', orderIndex: 0, mappedStatus: 'TODO', allowedTransitions: [] } });
    secondColumn = await prisma.boardColumn.create({ data: { projectId: project.id, name: 'Done', orderIndex: 1, mappedStatus: 'DONE', allowedTransitions: [] } });
  });
  test.afterAll(async () => {
    if (project) await prisma.project.deleteMany({ where: { id: project.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('captures, validates and publishes an immutable revision', async () => {
    const scheme = await workflowSchemeService.get(project.id);
    const config = scheme.draftConfig;
    config.columns[0].name = 'Ready';
    config.columns[0].allowedTransitions = [secondColumn.id];
    config.policies = [{ itemType: 'TASK', requiresTestsForDone: true, requiresPassingTest: true, requiresWorklogForDone: false, minimumLoggedMinutes: 0, requiredFields: [] }];
    await workflowSchemeService.saveDraft(project.id, config);
    const published = await workflowSchemeService.publish(project.id, user.id, 'Require passing tests');
    expect(published.publishedVersion).toBe(1);
    expect(published.revisions).toHaveLength(1);
    await expect(prisma.boardColumn.findUnique({ where: { id: firstColumn.id } })).resolves.toMatchObject({ name: 'Ready', allowedTransitions: [secondColumn.id] });
    await expect(prisma.workItemPolicy.findUnique({ where: { projectId_itemType: { projectId: project.id, itemType: 'TASK' } } })).resolves.toMatchObject({ requiresPassingTest: true });
  });

  test('restores a historical version into draft without mutating live workflow', async () => {
    const scheme = await workflowSchemeService.get(project.id);
    await workflowSchemeService.restoreRevision(project.id, scheme.revisions[0].id);
    const restored = await workflowSchemeService.get(project.id);
    expect(restored.status).toBe('DRAFT');
    expect(restored.publishedVersion).toBe(1);
    expect(restored.publishedConfig).toBeTruthy();
  });

  test('enforces published transitions and completion policies on board moves', async () => {
    const agileService = new AgileService();
    const blockedColumn = await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'Blocked', orderIndex: 2, mappedStatus: 'IN_PROGRESS', allowedTransitions: [] },
    });
    const item = await prisma.workItem.create({
      data: {
        key: `WF-${Date.now()}`,
        sequenceNumber: Math.floor(Date.now() / 1000),
        projectId: project.id,
        itemType: 'TASK',
        title: 'Policy protected work',
        boardColumnId: firstColumn.id,
        status: 'TODO',
      },
    });

    await expect(agileService.moveItem('task', item.id, blockedColumn.id)).rejects.toThrow('izin verilmiyor');
    await expect(agileService.moveItem('task', item.id, secondColumn.id)).rejects.toThrow('Tamamlama kuralları sağlanmadı');
    await expect(prisma.workItem.findUnique({ where: { id: item.id } })).resolves.toMatchObject({
      boardColumnId: firstColumn.id,
      status: 'TODO',
    });
  });

  test('enforces transition-specific conditions and validators, then applies post-actions atomically', async () => {
    const agileService = new AgileService();
    const blockedColumn = await prisma.boardColumn.findFirstOrThrow({ where: { projectId: project.id, name: 'Blocked' } });
    const refreshed = await workflowSchemeService.refreshDraftFromLive(project.id);
    const config = refreshed.draftConfig;
    config.columns = config.columns.map((column) => column.id === firstColumn.id
      ? { ...column, allowedTransitions: [...new Set([...column.allowedTransitions, blockedColumn.id])] }
      : column);
    config.transitions = [{
      id: 'strict-transition',
      name: 'Operational approval',
      fromColumnId: firstColumn.id,
      toColumnId: blockedColumn.id,
      itemTypes: ['OPERATIONAL'],
      conditions: [{ type: 'ROLE_ALLOWED', values: ['ADMIN'] }, { type: 'ASSIGNEE_REQUIRED', values: [] }],
      validators: [{ type: 'REQUIRED_FIELDS', fields: ['rollbackPlan'] }, { type: 'MIN_WORKLOG', minimumMinutes: 30 }],
      postActions: [{ type: 'SET_PRIORITY', value: 'CRITICAL' }, { type: 'ADD_COMMENT', value: 'Workflow gate completed.' }],
    }];
    await workflowSchemeService.saveDraft(project.id, config);
    await workflowSchemeService.publish(project.id, user.id, 'Add strict operational transition');
    const item = await prisma.workItem.create({
      data: {
        key: `WF-OP-${Date.now()}`, sequenceNumber: Math.floor(Math.random() * 1000000000),
        projectId: project.id, itemType: 'OPERATIONAL', title: 'Production data correction',
        boardColumnId: firstColumn.id, status: 'TODO', reporterId: user.id,
      },
    });

    await expect(agileService.moveItem('task', item.id, blockedColumn.id, undefined, { userId: user.id, role: 'DEVELOPER' })).rejects.toThrow('rolünüz');
    await expect(agileService.moveItem('task', item.id, blockedColumn.id, undefined, { userId: user.id, role: 'ADMIN' })).rejects.toThrow('sorumlusu');
    await prisma.workItem.update({ where: { id: item.id }, data: { assigneeId: user.id, customFields: { rollbackPlan: 'Restore snapshot' } } });
    await expect(agileService.moveItem('task', item.id, blockedColumn.id, undefined, { userId: user.id, role: 'ADMIN' })).rejects.toThrow('30 dakika');
    await prisma.worklog.create({ data: { userId: user.id, projectId: project.id, workItemId: item.id, startedAt: new Date(), durationMinutes: 30, category: 'OPERATIONS' } });

    await expect(agileService.moveItem('task', item.id, blockedColumn.id, undefined, { userId: user.id, role: 'ADMIN' })).resolves.toMatchObject({
      boardColumnId: blockedColumn.id, status: 'IN_PROGRESS', priority: 'CRITICAL',
    });
    await expect(prisma.comment.findFirst({ where: { workItemId: item.id, content: 'Workflow gate completed.' } })).resolves.toBeTruthy();
  });
});
