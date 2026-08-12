import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

export class TestRunReportService {
    async getConflictItems(testRunId: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({ where: { id: testRunId } });
        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        return prisma.testRunItem.findMany({
            where: {
                testRunId,
                finalStatus: 'CONFLICT',
            },
            include: {
                testCase: { select: { title: true, priority: true } },
                assignee: { select: { firstName: true, lastName: true } },
            },
        });
    }

    async getComparisonReport(testRunId: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({ where: { id: testRunId } });
        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        const items = await prisma.testRunItem.findMany({
            where: { testRunId },
            select: {
                manualStatus: true,
                automationStatus: true,
            },
        });

        let matched = 0;
        let conflicts = 0;
        let manualOnly = 0;
        let automationOnly = 0;
        let dualExecution = 0;

        for (const item of items) {
            const hasManual = item.manualStatus !== 'UNTESTED';
            const hasAutomation = item.automationStatus && item.automationStatus !== 'UNTESTED';

            if (hasManual && hasAutomation) {
                dualExecution++;
                if (item.manualStatus === item.automationStatus) {
                    matched++;
                } else {
                    conflicts++;
                }
            } else if (hasManual) {
                manualOnly++;
            } else if (hasAutomation) {
                automationOnly++;
            }
        }

        const matchRate = dualExecution > 0
            ? Number(((matched / dualExecution) * 100).toFixed(2))
            : 0;

        return {
            totalTests: items.length,
            manualOnly,
            automationOnly,
            dualExecution,
            matched,
            conflicts,
            matchRate,
        };
    }

    async getReport(testRunId: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({
            where: { id: testRunId },
            include: {
                items: {
                    include: {
                        testCase: { select: { title: true } },
                        assignee: { select: { firstName: true, lastName: true } },
                        results: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        const items = run.items;
        const totalCases = items.length;

        const summary = {
            Passed: 0,
            Failed: 0,
            Blocked: 0,
            Skipped: 0,
            Untested: 0
        };

        let totalDurationMs = 0;

        const cases = items.map(item => {
            const status = item.finalStatus === 'PASS' ? 'Passed' :
                item.finalStatus === 'FAIL' ? 'Failed' :
                    item.finalStatus === 'BLOCK' ? 'Blocked' :
                        item.finalStatus === 'UNTESTED' ? 'Untested' : item.finalStatus;

            if (status === 'Passed') summary.Passed++;
            else if (status === 'Failed') summary.Failed++;
            else if (status === 'Blocked') summary.Blocked++;
            else if (status === 'Untested') summary.Untested++;

            const result = item.results[0];
            const durationMs = result?.duration || 0;
            totalDurationMs += durationMs;

            return {
                id: item.testCaseId,
                title: item.caseTitle || item.testCase.title,
                status: status,
                duration: durationMs > 0 ? `${durationMs}ms` : '-',
                assignee: item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : 'Unassigned',
                error: result?.comment || (result?.status === 'FAIL' ? 'Test Failed' : undefined),
            };
        });

        const passRate = totalCases > 0 ? ((summary.Passed / totalCases) * 100).toFixed(1) : "0.0";

        const hours = Math.floor(totalDurationMs / 3600000);
        const minutes = Math.floor((totalDurationMs % 3600000) / 60000);
        const seconds = Math.floor(((totalDurationMs % 3600000) % 60000) / 1000);
        const durationStr = `${hours}h ${minutes}m ${seconds}s`;

        return {
            id: run.id,
            summary: [
                { name: "Passed", value: summary.Passed, color: "#22c55e" },
                { name: "Failed", value: summary.Failed, color: "#ef4444" },
                { name: "Blocked", value: summary.Blocked, color: "#eab308" },
                { name: "Untested", value: summary.Untested, color: "#94a3b8" },
            ],
            metrics: {
                totalCases,
                passRate: `${passRate}%`,
                duration: durationStr
            },
            cases
        };
    }
}

export const testRunReportService = new TestRunReportService();
