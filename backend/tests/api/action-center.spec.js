const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { actionCenterService } = require(path.join(__dirname, '../../dist/services/action-center.service.js'));

test.describe.serial('enterprise action center', () => {
  let organization;
  let foreignOrganization;
  let admin;
  let member;
  let foreignUser;
  let project;
  let foreignProject;
  let criticalBug;
  let overdueItem;
  let release;
  let initiative;

  const actor = () => ({ userId: admin.id, organizationId: organization.id, role: 'ADMIN' });
  const memberActor = () => ({ userId: member.id, organizationId: organization.id, role: 'DEVELOPER' });

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    organization = await prisma.organization.create({ data: { name: `Action Center ${suffix}`, slug: `action-center-${suffix}` } });
    foreignOrganization = await prisma.organization.create({ data: { name: `Foreign Action ${suffix}`, slug: `foreign-action-${suffix}` } });
    admin = await prisma.user.create({ data: { email: `action-admin-${suffix}@example.com`, password: 'hash', firstName: 'Action', lastName: 'Admin', role: 'ADMIN' } });
    member = await prisma.user.create({ data: { email: `action-member-${suffix}@example.com`, password: 'hash', firstName: 'Action', lastName: 'Member', role: 'DEVELOPER' } });
    foreignUser = await prisma.user.create({ data: { email: `action-foreign-${suffix}@example.com`, password: 'hash', firstName: 'Foreign', lastName: 'User', role: 'ADMIN' } });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: organization.id, userId: admin.id, isOwner: true },
      { organizationId: organization.id, userId: member.id },
      { organizationId: foreignOrganization.id, userId: foreignUser.id, isOwner: true },
    ] });
    project = await prisma.project.create({ data: { organizationId: organization.id, name: 'Payments', key: `AC${suffix.slice(-7)}`, qualityTier: 'TIER_1' } });
    foreignProject = await prisma.project.create({ data: { organizationId: foreignOrganization.id, name: 'Foreign', key: `AF${suffix.slice(-7)}` } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id } });
    criticalBug = await prisma.workItem.create({ data: {
      projectId: project.id, key: `${project.key}-1`, sequenceNumber: 1, itemType: 'BUG', title: 'Payment corruption',
      status: 'OPEN', severity: 'CRITICAL', assigneeId: member.id,
    } });
    const sprint = await prisma.sprint.create({ data: {
      projectId: project.id, name: 'Expired sprint', status: 'ACTIVE',
      startDate: new Date(Date.now() - 14 * 86_400_000), endDate: new Date(Date.now() - 2 * 86_400_000),
    } });
    overdueItem = await prisma.workItem.create({ data: {
      projectId: project.id, key: `${project.key}-2`, sequenceNumber: 2, itemType: 'TASK', title: 'Late settlement task',
      status: 'IN_PROGRESS', sprintId: sprint.id, assigneeId: member.id,
    } });
    release = await prisma.releaseCandidate.create({ data: {
      projectId: project.id, key: `REL${suffix.slice(-7)}`, sequenceNumber: 1, title: 'Payments release', createdById: admin.id,
      readinessScore: 72, failedRunItems: 2, traceabilityGaps: 1,
    } });
    const portfolio = await prisma.portfolio.create({ data: {
      organizationId: organization.id, ownerId: admin.id, name: 'Strategic payments',
    } });
    const program = await prisma.portfolioProgram.create({ data: { portfolioId: portfolio.id, name: 'Trust' } });
    initiative = await prisma.portfolioInitiative.create({ data: {
      programId: program.id, projectId: project.id, ownerId: member.id, title: 'Harden settlement', status: 'AT_RISK', priority: 'HIGH',
    } });
    await prisma.workItem.create({ data: {
      projectId: foreignProject.id, key: `${foreignProject.key}-1`, sequenceNumber: 1, itemType: 'BUG', title: 'Foreign critical bug',
      status: 'OPEN', severity: 'CRITICAL',
    } });
  });

  test.afterAll(async () => {
    if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
    if (foreignOrganization) await prisma.organization.deleteMany({ where: { id: foreignOrganization.id } });
    const ids = [admin?.id, member?.id, foreignUser?.id].filter(Boolean);
    if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('reconciles all risk sources idempotently and never crosses the tenant boundary', async () => {
    const first = await actionCenterService.reconcile(actor());
    expect(first.reconciliation.detected).toBe(4);
    expect(await prisma.actionCenterItem.count({ where: { organizationId: organization.id } })).toBe(4);
    expect(await prisma.actionCenterItem.count({ where: { organizationId: foreignOrganization.id } })).toBe(0);

    const second = await actionCenterService.reconcile(actor());
    expect(second.reconciliation.detected).toBe(4);
    expect(await prisma.actionCenterItem.count({ where: { organizationId: organization.id } })).toBe(4);

    await prisma.workItem.update({ where: { id: criticalBug.id }, data: { status: 'DONE' } });
    const resolved = await actionCenterService.reconcile(actor());
    expect(resolved.reconciliation.autoResolved).toBe(1);
    await expect(prisma.actionCenterItem.findUnique({
      where: { organizationId_dedupeKey: { organizationId: organization.id, dedupeKey: `critical-bug:${criticalBug.id}` } },
    })).resolves.toMatchObject({ status: 'RESOLVED' });

    await prisma.workItem.update({ where: { id: criticalBug.id }, data: { status: 'OPEN' } });
    const reopened = await actionCenterService.reconcile(actor());
    expect(reopened.reconciliation.reopened).toBe(1);
  });

  test('lists only accessible project actions and produces actionable summary facets', async () => {
    const result = await actionCenterService.list(memberActor(), { mode: 'open', limit: 100 });
    expect(result.total).toBe(4);
    expect(result.items.every((item) => item.projectId === project.id)).toBe(true);
    expect(result.facets.projects).toEqual([{ id: project.id, key: project.key, name: project.name }]);
    expect(result.facets.assignees.map((item) => item.id)).toEqual(expect.arrayContaining([admin.id, member.id]));
    const summary = await actionCenterService.summary(memberActor());
    expect(summary.open).toBe(4);
    expect(summary.critical).toBeGreaterThanOrEqual(1);

    const foreign = await actionCenterService.list({ userId: foreignUser.id, organizationId: foreignOrganization.id, role: 'ADMIN' }, { mode: 'open' });
    expect(foreign.total).toBe(0);
  });

  test('supports governed update, bulk resolution and idempotent work item conversion', async () => {
    const releaseAction = await prisma.actionCenterItem.findUniqueOrThrow({
      where: { organizationId_dedupeKey: { organizationId: organization.id, dedupeKey: `release-readiness:${release.id}` } },
    });
    const initiativeAction = await prisma.actionCenterItem.findUniqueOrThrow({
      where: { organizationId_dedupeKey: { organizationId: organization.id, dedupeKey: `initiative-risk:${initiative.id}` } },
    });
    const snoozedUntil = new Date(Date.now() + oneDayForTest());
    const assigned = await actionCenterService.update(actor(), releaseAction.id, { assigneeId: member.id, snoozedUntil });
    expect(assigned.item).toMatchObject({ assigneeId: member.id, snoozedUntil });

    await actionCenterService.bulkUpdate(actor(), { ids: [releaseAction.id, initiativeAction.id], assigneeId: member.id, status: 'IN_PROGRESS' });
    const bulk = await actionCenterService.bulkUpdate(memberActor(), {
      ids: [releaseAction.id, initiativeAction.id], status: 'RESOLVED', resolution: 'Risk azaltma kanıtları incelendi ve tamamlandı.',
    });
    expect(bulk.updated).toBe(2);

    await actionCenterService.update(actor(), initiativeAction.id, { status: 'IN_PROGRESS' });
    const firstConversion = await actionCenterService.convertToWorkItem(actor(), initiativeAction.id);
    const secondConversion = await actionCenterService.convertToWorkItem(actor(), initiativeAction.id);
    expect(firstConversion.created).toBe(true);
    expect(secondConversion).toMatchObject({ id: firstConversion.id, key: firstConversion.key, created: false });
    expect(await prisma.workItem.count({ where: { id: firstConversion.id, itemType: 'OPERATIONAL' } })).toBe(1);

    const criticalAction = await prisma.actionCenterItem.findUniqueOrThrow({
      where: { organizationId_dedupeKey: { organizationId: organization.id, dedupeKey: `critical-bug:${criticalBug.id}` } },
    });
    const linked = await actionCenterService.convertToWorkItem(actor(), criticalAction.id);
    expect(linked).toMatchObject({ id: criticalBug.id, key: criticalBug.key, created: false });

    await expect(actionCenterService.update(actor(), releaseAction.id, { assigneeId: foreignUser.id })).rejects.toMatchObject({ statusCode: 400 });
    expect(overdueItem.id).toBeTruthy();
  });
});

function oneDayForTest() {
  return 86_400_000;
}
