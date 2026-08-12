const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { sprintPlanningService } = require(path.join(__dirname, '../../dist/services/sprint-planning.service.js'));
const { workItemService } = require(path.join(__dirname, '../../dist/services/workitem.service.js'));

test.describe.serial('enterprise sprint planning', () => {
  let user;
  let project;
  let sprint;
  let firstItem;
  let secondItem;
  const organizationId = '00000000-0000-0000-0000-000000000001';

  test.beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await prisma.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: { id: organizationId, name: 'Default test organization', slug: 'default-test-organization' },
    });
    user = await prisma.user.create({ data: { email: `planning-${suffix}@example.com`, password: 'test-hash', firstName: 'Plan', lastName: 'Owner', role: 'ADMIN' } });
    await prisma.organizationMember.create({ data: { organizationId, userId: user.id, isOwner: true } });
    project = await prisma.project.create({ data: { name: `Planning ${suffix}`, key: `P${suffix.replace(/\D/g, '').slice(-7)}`, organizationId } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, weeklyCapacityMinutes: 2400 } });
    sprint = await prisma.sprint.create({ data: { name: 'Planning Sprint', projectId: project.id, goal: 'Deliver verified scope', capacityPoints: 8, startDate: new Date('2026-07-20T00:00:00Z'), endDate: new Date('2026-07-31T00:00:00Z') } });
    firstItem = await prisma.workItem.create({ data: { key: `${project.key}-1`, sequenceNumber: 1, projectId: project.id, itemType: 'TASK', title: 'API work', storyPoints: 3, sprintId: sprint.id, assigneeId: user.id, acceptanceCriteria: 'API responds' } });
    secondItem = await prisma.workItem.create({ data: { key: `${project.key}-2`, sequenceNumber: 2, projectId: project.id, itemType: 'TASK', title: 'UI work', storyPoints: 5, acceptanceCriteria: 'UI renders' } });
  });

  test.afterAll(async () => {
    if (project) await prisma.project.deleteMany({ where: { id: project.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('capacity, PERT and deterministic simulation are calculated together', async () => {
    await sprintPlanningService.saveMemberCapacity(sprint.id, user.id, { dailyCapacityMinutes: 480, focusPercent: 80, meetingMinutes: 120, disciplineAllocations: [{ discipline: 'BACKEND', percent: 70 }, { discipline: 'TESTING', percent: 30 }], skills: ['postgresql'] }, user.id, 'ADMIN');
    await sprintPlanningService.saveEstimate(sprint.id, firstItem.id, { optimisticMinutes: 600, mostLikelyMinutes: 900, pessimisticMinutes: 1500, valueScore: 90, riskScore: 30, confidence: 80, refinementReady: true, disciplineDemands: [{ discipline: 'BACKEND', minutes: 900, skill: 'postgresql' }] }, user.id, 'ADMIN');
    const first = await sprintPlanningService.report(sprint.id, user.id, 'ADMIN');
    const second = await sprintPlanningService.report(sprint.id, user.id, 'ADMIN');

    expect(first.members[0].netMinutes).toBeGreaterThan(0);
    expect(first.disciplineCapacity.BACKEND).toBeGreaterThan(0);
    expect(first.skillGaps).toEqual([]);
    expect(first.scenarios[0].simulations).toBe(5000);
    expect(first.scenarios.map((row) => row.confidence)).toEqual(second.scenarios.map((row) => row.confidence));
  });

  test('cyclic dependencies are rejected and records can be removed', async () => {
    const dependency = await sprintPlanningService.addDependency(sprint.id, { sourceWorkItemId: secondItem.id, targetWorkItemId: firstItem.id, type: 'DEPENDS_ON' }, user.id, 'ADMIN');
    await expect(sprintPlanningService.addDependency(sprint.id, { sourceWorkItemId: firstItem.id, targetWorkItemId: secondItem.id, type: 'DEPENDS_ON' }, user.id, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 });
    await expect(sprintPlanningService.deleteDependency(sprint.id, dependency.id, user.id, 'ADMIN')).resolves.toEqual({ success: true });
  });

  test('locked planning scope blocks work item movement', async () => {
    const session = await sprintPlanningService.createSession(sprint.id, {}, user.id, 'ADMIN');
    await sprintPlanningService.transitionSession(sprint.id, session.id, 'IN_PROGRESS', user.id, 'ADMIN');
    const locked = await sprintPlanningService.transitionSession(sprint.id, session.id, 'LOCKED', user.id, 'ADMIN');
    expect(locked.scopeHash).toHaveLength(64);
    expect(locked.status).toBe('LOCKED');
    await expect(workItemService.update(secondItem.id, { sprintId: sprint.id }, user.id)).rejects.toMatchObject({ statusCode: 409 });
    await prisma.sprint.update({ where: { id: sprint.id }, data: { status: 'CLOSED' } });
    await expect(sprintPlanningService.saveMemberCapacity(sprint.id, user.id, { dailyCapacityMinutes: 420 }, user.id, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 });
    await expect(sprintPlanningService.report(sprint.id, user.id, 'ADMIN')).resolves.toMatchObject({ sprint: { status: 'CLOSED' } });
  });
});
