const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { dashboardStudioService } = require(path.join(__dirname, '../../dist/services/dashboard-studio.service.js'));

test.describe.serial('dashboard studio tenant and concurrency safeguards', () => {
  let organization;
  let foreignOrganization;
  let admin;
  let teamLeader;
  let member;
  let foreignUser;
  let project;
  let hiddenProject;
  let foreignProject;
  let organizationDashboard;
  let projectDashboard;
  let hiddenDashboard;
  let foreignDashboard;
  let memberPersonalDashboard;
  const actionIds = {};

  const adminActor = () => ({ userId: admin.id, organizationId: organization.id, role: 'ADMIN' });
  const leaderActor = () => ({ userId: teamLeader.id, organizationId: organization.id, role: 'TEAM_LEADER' });
  const memberActor = () => ({ userId: member.id, organizationId: organization.id, role: 'DEVELOPER' });
  const memberForeignActor = () => ({ userId: member.id, organizationId: foreignOrganization.id, role: 'DEVELOPER' });

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    organization = await prisma.organization.create({ data: { name: `Dashboard Studio ${suffix}`, slug: `dashboard-studio-${suffix}` } });
    foreignOrganization = await prisma.organization.create({ data: { name: `Foreign Dashboard ${suffix}`, slug: `foreign-dashboard-${suffix}` } });
    admin = await prisma.user.create({ data: { email: `dashboard-admin-${suffix}@example.com`, password: 'hash', firstName: 'Dashboard', lastName: 'Admin', role: 'ADMIN' } });
    teamLeader = await prisma.user.create({ data: { email: `dashboard-lead-${suffix}@example.com`, password: 'hash', firstName: 'Dashboard', lastName: 'Lead', role: 'TEAM_LEADER' } });
    member = await prisma.user.create({ data: { email: `dashboard-member-${suffix}@example.com`, password: 'hash', firstName: 'Dashboard', lastName: 'Member', role: 'DEVELOPER' } });
    foreignUser = await prisma.user.create({ data: { email: `dashboard-foreign-${suffix}@example.com`, password: 'hash', firstName: 'Foreign', lastName: 'Admin', role: 'ADMIN' } });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: organization.id, userId: admin.id, isOwner: true },
      { organizationId: organization.id, userId: teamLeader.id },
      { organizationId: organization.id, userId: member.id },
      { organizationId: foreignOrganization.id, userId: foreignUser.id, isOwner: true },
      { organizationId: foreignOrganization.id, userId: member.id },
    ] });

    project = await prisma.project.create({ data: { organizationId: organization.id, name: 'Visible project', key: `DV${suffix.slice(-7)}` } });
    hiddenProject = await prisma.project.create({ data: { organizationId: organization.id, name: 'Hidden project', key: `DH${suffix.slice(-7)}` } });
    foreignProject = await prisma.project.create({ data: { organizationId: foreignOrganization.id, name: 'Foreign project', key: `DF${suffix.slice(-7)}` } });
    await prisma.projectMember.createMany({ data: [
      { projectId: project.id, userId: teamLeader.id },
      { projectId: project.id, userId: member.id },
    ] });

    organizationDashboard = await prisma.dashboardDefinition.create({
      data: {
        organizationId: organization.id,
        ownerId: admin.id,
        name: 'Organization quality',
        scope: 'ORGANIZATION',
        widgets: { create: [{ type: 'RISK_ACTIONS', title: 'Risks', positionX: 0, positionY: 0, width: 6, height: 3, config: {} }] },
      },
      include: { widgets: true },
    });
    projectDashboard = await prisma.dashboardDefinition.create({
      data: {
        organizationId: organization.id,
        projectId: project.id,
        ownerId: admin.id,
        name: 'Visible project quality',
        scope: 'PROJECT',
        widgets: { create: [{ type: 'RISK_ACTIONS', title: 'Project risks', positionX: 0, positionY: 0, width: 6, height: 3, config: {} }] },
      },
      include: { widgets: true },
    });
    hiddenDashboard = await prisma.dashboardDefinition.create({
      data: {
        organizationId: organization.id,
        projectId: hiddenProject.id,
        ownerId: admin.id,
        name: 'Hidden project quality',
        scope: 'PROJECT',
        widgets: { create: [{ type: 'KPI_WORK_ITEMS', title: 'Hidden work', positionX: 0, positionY: 0, width: 3, height: 2, config: {} }] },
      },
      include: { widgets: true },
    });
    foreignDashboard = await prisma.dashboardDefinition.create({
      data: {
        organizationId: foreignOrganization.id,
        ownerId: foreignUser.id,
        name: 'Foreign organization quality',
        scope: 'ORGANIZATION',
        widgets: { create: [{ type: 'KPI_WORK_ITEMS', title: 'Foreign work', positionX: 0, positionY: 0, width: 3, height: 2, config: {} }] },
      },
      include: { widgets: true },
    });

    await prisma.workItem.createMany({ data: [
      { projectId: project.id, key: `${project.key}-1`, sequenceNumber: 1, itemType: 'TASK', title: 'Visible work', status: 'OPEN' },
      { projectId: hiddenProject.id, key: `${hiddenProject.key}-1`, sequenceNumber: 1, itemType: 'TASK', title: 'Hidden work', status: 'OPEN' },
      { projectId: foreignProject.id, key: `${foreignProject.key}-1`, sequenceNumber: 1, itemType: 'TASK', title: 'Foreign work', status: 'OPEN' },
    ] });

    const actions = await Promise.all([
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, projectId: project.id, assigneeId: member.id, sourceType: 'TEST', sourceId: 'visible-assigned', actionType: 'TEST', dedupeKey: `visible-assigned-${suffix}`, title: 'Visible assigned risk', severity: 'HIGH' } }),
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, projectId: project.id, sourceType: 'TEST', sourceId: 'visible-unassigned', actionType: 'TEST', dedupeKey: `visible-unassigned-${suffix}`, title: 'Visible unassigned risk', severity: 'MEDIUM' } }),
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, projectId: hiddenProject.id, sourceType: 'TEST', sourceId: 'hidden-project', actionType: 'TEST', dedupeKey: `hidden-project-${suffix}`, title: 'Hidden project risk', severity: 'CRITICAL' } }),
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, assigneeId: member.id, sourceType: 'TEST', sourceId: 'organization-assigned', actionType: 'TEST', dedupeKey: `organization-assigned-${suffix}`, title: 'Organization assigned risk', severity: 'HIGH' } }),
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, createdById: member.id, sourceType: 'TEST', sourceId: 'organization-created', actionType: 'TEST', dedupeKey: `organization-created-${suffix}`, title: 'Organization created risk', severity: 'MEDIUM' } }),
      prisma.actionCenterItem.create({ data: { organizationId: organization.id, createdById: admin.id, sourceType: 'TEST', sourceId: 'organization-hidden', actionType: 'TEST', dedupeKey: `organization-hidden-${suffix}`, title: 'Organization hidden risk', severity: 'CRITICAL' } }),
      prisma.actionCenterItem.create({ data: { organizationId: foreignOrganization.id, projectId: foreignProject.id, sourceType: 'TEST', sourceId: 'foreign', actionType: 'TEST', dedupeKey: `foreign-${suffix}`, title: 'Foreign risk', severity: 'CRITICAL' } }),
    ]);
    [
      actionIds.visibleAssigned,
      actionIds.visibleUnassigned,
      actionIds.hiddenProject,
      actionIds.organizationAssigned,
      actionIds.organizationCreated,
      actionIds.organizationHidden,
      actionIds.foreign,
    ] = actions.map((item) => item.id);
  });

  test.afterAll(async () => {
    if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
    if (foreignOrganization) await prisma.organization.deleteMany({ where: { id: foreignOrganization.id } });
    const userIds = [admin?.id, teamLeader?.id, member?.id, foreignUser?.id].filter(Boolean);
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test('lists only readable dashboards and replaces a stale inaccessible preference', async () => {
    await dashboardStudioService.ensureDefault(memberActor());
    const dashboards = await dashboardStudioService.list(memberActor());
    const ids = dashboards.map((dashboard) => dashboard.id);
    expect(ids).toContain(organizationDashboard.id);
    expect(ids).toContain(projectDashboard.id);
    expect(ids).not.toContain(hiddenDashboard.id);
    expect(ids).not.toContain(foreignDashboard.id);

    memberPersonalDashboard = dashboards.find((dashboard) => dashboard.scope === 'PERSONAL' && dashboard.ownerId === member.id);
    expect(memberPersonalDashboard).toBeTruthy();
    await expect(dashboardStudioService.data(memberActor(), hiddenDashboard.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(dashboardStudioService.data(memberActor(), foreignDashboard.id)).rejects.toMatchObject({ statusCode: 404 });

    const memberPreferenceKey = { userId_organizationId: { userId: member.id, organizationId: organization.id } };
    await prisma.dashboardPreference.update({ where: memberPreferenceKey, data: { dashboardId: hiddenDashboard.id } });
    const recovered = await dashboardStudioService.ensureDefault(memberActor());
    expect(recovered.id).toBe(memberPersonalDashboard.id);
    await expect(prisma.dashboardPreference.findUnique({ where: memberPreferenceKey })).resolves.toMatchObject({ dashboardId: memberPersonalDashboard.id });
  });

  test('enforces shared-dashboard write policy and optimistic layout locking', async () => {
    await expect(dashboardStudioService.saveLayout(memberActor(), projectDashboard.id, [], projectDashboard.layoutVersion)).rejects.toMatchObject({ statusCode: 404 });
    await expect(dashboardStudioService.saveLayout(leaderActor(), organizationDashboard.id, [], organizationDashboard.layoutVersion)).rejects.toMatchObject({ statusCode: 404 });
    await expect(dashboardStudioService.create(leaderActor(), { name: 'Forbidden organization dashboard', scope: 'ORGANIZATION' })).rejects.toMatchObject({ statusCode: 403 });

    const widget = projectDashboard.widgets[0];
    const saved = await dashboardStudioService.saveLayout(leaderActor(), projectDashboard.id, [{
      id: widget.id,
      type: widget.type,
      title: widget.title,
      positionX: 1,
      positionY: 0,
      width: widget.width,
      height: widget.height,
      config: {},
    }], projectDashboard.layoutVersion);
    expect(saved.layoutVersion).toBe(projectDashboard.layoutVersion + 1);
    expect(saved.widgets[0].positionX).toBe(1);

    await expect(dashboardStudioService.saveLayout(leaderActor(), projectDashboard.id, [], projectDashboard.layoutVersion)).rejects.toMatchObject({ statusCode: 409 });
    await expect(dashboardStudioService.saveLayout(leaderActor(), projectDashboard.id, [], undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('keeps defaults per user and validates widget ownership and project filters', async () => {
    const foreignPersonalDashboard = await dashboardStudioService.ensureDefault(memberForeignActor());
    expect(foreignPersonalDashboard).toMatchObject({ organizationId: foreignOrganization.id, ownerId: member.id, isDefault: true });
    const memberOrganizations = (await prisma.dashboardPreference.findMany({ where: { userId: member.id }, select: { organizationId: true } }))
      .map((preference) => preference.organizationId);
    expect(memberOrganizations).toEqual(expect.arrayContaining([organization.id, foreignOrganization.id]));

    await dashboardStudioService.setDefault(memberActor(), organizationDashboard.id);
    const adminDefault = await dashboardStudioService.ensureDefault(adminActor());
    await dashboardStudioService.setDefault(adminActor(), projectDashboard.id);
    const [memberPreference, adminPreference] = await Promise.all([
      prisma.dashboardPreference.findUnique({ where: { userId_organizationId: { userId: member.id, organizationId: organization.id } } }),
      prisma.dashboardPreference.findUnique({ where: { userId_organizationId: { userId: admin.id, organizationId: organization.id } } }),
    ]);
    expect(memberPreference.dashboardId).toBe(organizationDashboard.id);
    expect(adminPreference.dashboardId).toBe(projectDashboard.id);
    expect(adminDefault.ownerId).toBe(admin.id);

    const currentOrganizationDashboard = await prisma.dashboardDefinition.findUniqueOrThrow({ where: { id: organizationDashboard.id }, include: { widgets: true } });
    await expect(dashboardStudioService.saveLayout(adminActor(), organizationDashboard.id, [{
      id: hiddenDashboard.widgets[0].id,
      type: 'KPI_WORK_ITEMS',
      title: 'Cross-dashboard widget',
      config: {},
    }], currentOrganizationDashboard.layoutVersion)).rejects.toMatchObject({ statusCode: 400 });
    await expect(dashboardStudioService.saveLayout(adminActor(), organizationDashboard.id, [{
      id: `draft-${Date.now()}`,
      type: 'KPI_WORK_ITEMS',
      title: 'Foreign filter',
      config: { projectId: foreignProject.id },
    }], currentOrganizationDashboard.layoutVersion)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('scopes risk and KPI widget data without crossing project or tenant boundaries', async () => {
    const personalData = await dashboardStudioService.data(memberActor(), memberPersonalDashboard.id);
    const risk = personalData.widgets.find((widget) => widget.type === 'RISK_ACTIONS');
    const work = personalData.widgets.find((widget) => widget.type === 'KPI_WORK_ITEMS');
    const riskIds = risk.data.items.map((item) => item.id);
    expect(riskIds).toEqual(expect.arrayContaining([
      actionIds.visibleAssigned,
      actionIds.visibleUnassigned,
      actionIds.organizationAssigned,
      actionIds.organizationCreated,
    ]));
    expect(riskIds).not.toContain(actionIds.hiddenProject);
    expect(riskIds).not.toContain(actionIds.organizationHidden);
    expect(riskIds).not.toContain(actionIds.foreign);
    expect(work.data).toMatchObject({ value: 1, unit: 'COUNT' });

    const projectData = await dashboardStudioService.data(memberActor(), projectDashboard.id);
    const projectRisk = projectData.widgets.find((widget) => widget.type === 'RISK_ACTIONS');
    const projectRiskIds = projectRisk.data.items.map((item) => item.id);
    expect(projectRiskIds).toEqual(expect.arrayContaining([actionIds.visibleAssigned, actionIds.visibleUnassigned]));
    expect(projectRiskIds).not.toContain(actionIds.organizationAssigned);
    expect(projectRiskIds).not.toContain(actionIds.organizationCreated);
  });
});
