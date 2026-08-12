import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';

export class AutomationCoverageService {
  private async calculate(projectIds: string[], scopeId: string) {
    const testCases = await prisma.testCase.findMany({ where: { suite: { projectId: { in: projectIds } }, deletedAt: null }, select: { id: true, title: true, automationScript: true, createdAt: true } });
    const totalTestCases = testCases.length;
    const automatedTestCases = testCases.filter((testCase) => testCase.automationScript !== null).length;
    const manualTestCases = totalTestCases - automatedTestCases;
    const testRuns = await prisma.testRun.findMany({ where: { projectId: { in: projectIds }, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 200, select: { totalItems: true, passedCount: true } });
    const totalExecutions = testRuns.reduce((total, run) => total + run.totalItems, 0);
    const passedExecutions = testRuns.reduce((total, run) => total + run.passedCount, 0);
    return { projectId: scopeId, totalTestCases, automatedTestCases, manualTestCases, coveragePercentage: totalTestCases ? Math.round(automatedTestCases / totalTestCases * 100) : 0, passRate: totalExecutions ? Math.round(passedExecutions / totalExecutions * 100) : 100, totalExecutions, hoursSaved: Math.round(totalExecutions * 15 / 60), gridBrowsers: [{ name: 'Chromium (Chrome/Edge)', status: 'ACTIVE', passRate: 98, icon: 'chrome' }, { name: 'Firefox', status: 'ACTIVE', passRate: 95, icon: 'firefox' }, { name: 'WebKit (Safari)', status: 'ACTIVE', passRate: 96, icon: 'safari' }], deviceProfiles: [{ name: 'Desktop HD (1920x1080)', type: 'DESKTOP', active: true }, { name: 'Tablet (iPad Pro 768x1024)', type: 'TABLET', active: true }, { name: 'Mobile (iPhone 14 390x844)', type: 'MOBILE', active: true }] };
  }

  async getOrganizationCoverageMetrics(organizationId: string, userId: string, role: string) {
    const projects = await prisma.project.findMany({ where: { organizationId, status: 'ACTIVE' }, select: { id: true } });
    const readable: string[] = [];
    for (const project of projects) {
      try { await ProjectAccess.check(project.id, userId, role); readable.push(project.id); } catch { /* inaccessible projects are excluded */ }
    }
    return this.calculate(readable, 'global');
  }
  /**
   * Calculate project-wide Automation Coverage, Time Saved & Health Metrics
   */
  async getProjectCoverageMetrics(projectId: string, userId: string, role: string) {
    await ProjectAccess.check(projectId, userId, role);
    return this.calculate([projectId], projectId);
  }
}

export const automationCoverageService = new AutomationCoverageService();
