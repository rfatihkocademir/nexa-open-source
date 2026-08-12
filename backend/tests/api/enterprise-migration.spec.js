const path = require('node:path');
const { test, expect } = require('@playwright/test');
const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { enterpriseMigrationService } = require(path.join(__dirname, '../../dist/services/enterprise-migration.service.js'));

test.describe.serial('enterprise Jira/Xray migration center', () => {
  let user;
  let project;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    user = await prisma.user.create({
      data: { email: `migration-${suffix}@example.com`, password: 'hash', firstName: 'Migration', lastName: 'Owner', role: 'ADMIN' },
    });
    project = await prisma.project.create({
      data: { name: `Migration ${suffix}`, key: `M${suffix.slice(-7)}` },
    });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } });
  });

  test.afterAll(async () => {
    if (project) await prisma.project.deleteMany({ where: { id: project.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('analyzes, dry-runs and imports Jira work items plus Xray tests', async () => {
    const payload = {
      issues: [
        { id: '10001', key: 'OLD-1', fields: {
          summary: 'Imported story', issuetype: { name: 'Story' }, status: { name: 'In Progress' }, priority: { name: 'High' }, description: 'From Jira',
          assignee: { accountId: 'acct-1', displayName: 'Migration Owner' },
          comment: { comments: [{ id: 'c-1', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Imported comment' }] }] }, author: { accountId: 'acct-1', displayName: 'Migration Owner' } }] },
          sprint: { id: 'sprint-1', name: 'Legacy Sprint', state: 'closed', goal: 'Migration goal' },
          labels: ['customer-facing', 'critical-flow'],
          issuelinks: [{ type: { name: 'Blocks' }, outwardIssue: { key: 'OLD-3' } }],
        } },
        { id: '10002', key: 'OLD-2', fields: { summary: 'Login test', issuetype: { name: 'Test' }, priority: { name: 'Medium' }, steps: [{ action: 'Login', result: 'Dashboard opens' }] } },
        { id: '10003', key: 'OLD-3', fields: { summary: 'Dependent task', issuetype: { name: 'Task' }, status: { name: 'To Do' }, priority: { name: 'Low' }, parent: { key: 'OLD-1' } } },
      ],
      xrayExecutions: [{ id: 'exec-1', key: 'OLD-EXEC-1', summary: 'Regression execution', status: 'completed', tests: [{ id: 'result-1', testIssueKey: 'OLD-2', status: 'PASS', comment: 'Migrated pass', executedByAccountId: 'acct-1', duration: 42 }] }],
    };
    const job = await enterpriseMigrationService.analyze(project.id, user.id, payload, { userMap: { 'acct-1': user.id } });
    expect(job.summary).toMatchObject({ total: 4, valid: 4, workItems: 2, testCases: 1, testExecutions: 1, comments: 1, links: 1, sprints: 1, labels: 2, hierarchyLinks: 1 });

    const preview = await enterpriseMigrationService.dryRun(project.id, job.id);
    expect(preview.summary).toMatchObject({ create: 4, update: 0, unchanged: 0 });

    const completed = await enterpriseMigrationService.execute(project.id, job.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.summary).toMatchObject({ created: 4, failed: 0 });
    const story = await prisma.workItem.findFirstOrThrow({ where: { projectId: project.id, customFields: { path: ['jiraKey'], equals: 'OLD-1' } } });
    expect(story).toMatchObject({ title: 'Imported story', itemType: 'STORY', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: user.id });
    expect(story.customFields.jiraLabels).toEqual(['customer-facing', 'critical-flow']);
    await expect(prisma.workItem.findFirst({ where: { projectId: project.id, customFields: { path: ['jiraKey'], equals: 'OLD-3' } } })).resolves.toMatchObject({ parentId: story.id });
    await expect(prisma.testCase.findFirst({ where: { suite: { projectId: project.id }, title: 'Login test' } })).resolves.toBeTruthy();
    await expect(prisma.comment.findFirst({ where: { workItemId: story.id, content: 'Imported comment' } })).resolves.toBeTruthy();
    await expect(prisma.sprint.findFirst({ where: { projectId: project.id, name: 'Legacy Sprint' } })).resolves.toMatchObject({ status: 'CLOSED', goal: 'Migration goal' });
    await expect(prisma.workItemDependency.findFirst({ where: { sourceWorkItemId: story.id, type: 'BLOCKS' } })).resolves.toBeTruthy();
    await expect(prisma.testRun.findFirst({ where: { projectId: project.id, title: 'Regression execution' } })).resolves.toMatchObject({ status: 'COMPLETED', totalItems: 1, passedCount: 1 });
    await expect(prisma.testResult.findFirst({ where: { runItem: { testRun: { projectId: project.id } } } })).resolves.toMatchObject({ status: 'PASS', comment: 'Migrated pass', duration: 42 });
  });

  test('is idempotent and updates changed source records without duplicates', async () => {
    const payload = {
      issues: [
        { id: '10001', key: 'OLD-1', fields: {
          summary: 'Imported story revised', issuetype: { name: 'Story' }, status: { name: 'Done' }, priority: { name: 'Highest' },
          assignee: { accountId: 'acct-1', displayName: 'Migration Owner' },
          comment: { comments: [{ id: 'c-1', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Imported comment' }] }] }, author: { accountId: 'acct-1', displayName: 'Migration Owner' } }] },
          sprint: { id: 'sprint-1', name: 'Legacy Sprint', state: 'closed', goal: 'Migration goal' },
          labels: ['customer-facing', 'critical-flow'],
          issuelinks: [{ type: { name: 'Blocks' }, outwardIssue: { key: 'OLD-3' } }],
        } },
        { id: '10002', key: 'OLD-2', fields: { summary: 'Login test', issuetype: { name: 'Test' }, priority: { name: 'Medium' }, steps: [{ action: 'Login', result: 'Dashboard opens' }] } },
        { id: '10003', key: 'OLD-3', fields: { summary: 'Dependent task', issuetype: { name: 'Task' }, status: { name: 'To Do' }, priority: { name: 'Low' }, parent: { key: 'OLD-1' } } },
      ],
      xrayExecutions: [{ id: 'exec-1', key: 'OLD-EXEC-1', summary: 'Regression execution', status: 'completed', tests: [{ id: 'result-1', testIssueKey: 'OLD-2', status: 'PASS', comment: 'Migrated pass', executedByAccountId: 'acct-1', duration: 42 }] }],
    };
    const job = await enterpriseMigrationService.analyze(project.id, user.id, payload, { userMap: { 'acct-1': user.id } });
    const preview = await enterpriseMigrationService.dryRun(project.id, job.id);
    expect(preview.summary).toMatchObject({ create: 0, update: 1, unchanged: 3 });
    const completed = await enterpriseMigrationService.execute(project.id, job.id);
    expect(completed.summary).toMatchObject({ created: 0, updated: 1, unchanged: 3, failed: 0 });
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(2);
    await expect(prisma.workItem.findFirst({ where: { projectId: project.id, customFields: { path: ['jiraKey'], equals: 'OLD-1' } } })).resolves.toMatchObject({ title: 'Imported story revised', status: 'DONE', priority: 'CRITICAL' });
  });

  test('blocks ambiguous duplicate source identities before import', async () => {
    const payload = {
      issues: [
        { id: 'duplicate', key: 'OLD-3', fields: { summary: 'First copy', issuetype: { name: 'Task' } } },
        { id: 'duplicate', key: 'OLD-3', fields: { summary: 'Second copy', issuetype: { name: 'Task' } } },
      ],
    };
    const job = await enterpriseMigrationService.analyze(project.id, user.id, payload, {});
    expect(job.summary).toMatchObject({ duplicates: 1, invalid: 1, valid: 1 });
    await expect(enterpriseMigrationService.execute(project.id, job.id)).rejects.toThrow('Hatalı kayıtlar düzeltilmeden');
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(2);
  });
});
