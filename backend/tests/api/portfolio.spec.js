const path = require('node:path');
const { test, expect } = require('@playwright/test');
const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { portfolioService } = require(path.join(__dirname, '../../dist/services/portfolio.service.js'));

test.describe.serial('enterprise portfolio planning', () => {
  let organization; let user; let projectA; let projectB; let portfolio; let program;
  const actor = () => ({ userId: user.id, organizationId: organization.id, role: 'ADMIN' });

  test.beforeAll(async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    organization = await prisma.organization.create({ data: { name: `Portfolio ${suffix}`, slug: `portfolio-${suffix}` } });
    user = await prisma.user.create({ data: { email: `portfolio-${suffix}@example.com`, password: 'hash', firstName: 'Portfolio', lastName: 'Owner', role: 'ADMIN' } });
    await prisma.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, isOwner: true } });
    projectA = await prisma.project.create({ data: { organizationId: organization.id, name: 'Payments', key: `PA${suffix.slice(-6)}`, qualityTier: 'TIER_1' } });
    projectB = await prisma.project.create({ data: { organizationId: organization.id, name: 'Identity', key: `PB${suffix.slice(-6)}` } });
    await prisma.projectMember.createMany({ data: [{ projectId: projectA.id, userId: user.id, weeklyCapacityMinutes: 2400 }, { projectId: projectB.id, userId: user.id, weeklyCapacityMinutes: 1800 }] });
    await prisma.workItem.createMany({ data: [
      { projectId: projectA.id, key: `${projectA.key}-1`, sequenceNumber: 1, itemType: 'STORY', title: 'Done', status: 'DONE', storyPoints: 5 },
      { projectId: projectA.id, key: `${projectA.key}-2`, sequenceNumber: 2, itemType: 'STORY', title: 'Open', status: 'IN_PROGRESS', storyPoints: 8 },
      { projectId: projectB.id, key: `${projectB.key}-1`, sequenceNumber: 1, itemType: 'BUG', title: 'Critical', status: 'OPEN', severity: 'CRITICAL', storyPoints: 3 },
    ] });
  });

  test.afterAll(async () => {
    if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
    if (user) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('creates hierarchy, cross-project dependencies and calculated health metrics', async () => {
    portfolio = await portfolioService.create(actor(), { name: 'Strategic Delivery', targetDate: new Date(Date.now() + 90 * 86400000) });
    program = await portfolioService.createProgram(actor(), portfolio.id, { name: 'Customer Trust', color: '#123456' });
    await portfolioService.linkProject(actor(), portfolio.id, { projectId: projectA.id, programId: program.id, priority: 90 });
    await portfolioService.linkProject(actor(), portfolio.id, { projectId: projectB.id, programId: program.id, priority: 80 });
    const first = await portfolioService.createInitiative(actor(), portfolio.id, { programId: program.id, projectId: projectA.id, title: 'Payments modernization', status: 'IN_PROGRESS', estimatedEffortPoints: 21 });
    const second = await portfolioService.createInitiative(actor(), portfolio.id, { programId: program.id, projectId: projectB.id, title: 'Identity hardening', status: 'BLOCKED', priority: 'CRITICAL', targetDate: new Date(Date.now() - 86400000) });
    await portfolioService.addDependency(actor(), portfolio.id, { sourceInitiativeId: second.id, targetInitiativeId: first.id });
    await prisma.workItem.updateMany({ where: { projectId: projectA.id }, data: { initiativeId: first.id } });

    const result = await portfolioService.dashboard(actor(), portfolio.id);
    expect(result.metrics).toMatchObject({ projectCount: 2, initiativeCount: 2, blockedCount: 1, criticalBugCount: 1 });
    expect(result.metrics.atRiskCount).toBeGreaterThanOrEqual(1);
    expect(result.programs[0].initiatives.find((item) => item.id === second.id)).toMatchObject({ overdue: true, progress: 0 });
    expect(result.projects.find((item) => item.id === projectA.id).progress).toBe(38);
  });

  test('calculates what-if capacity and scope impact without mutating the baseline', async () => {
    const baseline = await portfolioService.scenario(actor(), portfolio.id, {});
    const constrained = await portfolioService.scenario(actor(), portfolio.id, { capacityDeltaPercent: -50, addedEffortPoints: 20 });
    expect(constrained.forecastWeeks).toBeGreaterThan(baseline.forecastWeeks);
    expect(constrained.deltaWeeks).toBeGreaterThan(0);
    const unchanged = await portfolioService.dashboard(actor(), portfolio.id);
    expect(unchanged.metrics.projectCount).toBe(2);
  });

  test('rejects cross-organization project linkage and circular dependencies', async () => {
    const foreignOrg = await prisma.organization.create({ data: { name: 'Foreign portfolio', slug: `foreign-${Date.now()}` } });
    const foreignProject = await prisma.project.create({ data: { organizationId: foreignOrg.id, name: 'Foreign', key: `F${Date.now()}` } });
    await expect(portfolioService.linkProject(actor(), portfolio.id, { projectId: foreignProject.id })).rejects.toThrow(/Kurum kapsamında/);
    await prisma.organization.delete({ where: { id: foreignOrg.id } });
    const initiatives = await prisma.portfolioInitiative.findMany({ where: { programId: program.id } });
    await expect(portfolioService.addDependency(actor(), portfolio.id, { sourceInitiativeId: initiatives[0].id, targetInitiativeId: initiatives[1].id })).rejects.toThrow(/Döngüsel/);
  });
});
