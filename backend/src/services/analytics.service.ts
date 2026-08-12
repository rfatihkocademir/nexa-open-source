import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';

type Timeframe = 'WEEK' | 'SPRINT' | 'MONTH';

function getPeriod(timeframe: Timeframe, reference: Date = new Date()) {
    const end = new Date(reference);
    const start = new Date(reference);
    const days = timeframe === 'WEEK' ? 7 : timeframe === 'SPRINT' ? 14 : 30;
    start.setDate(start.getDate() - days);
    return { start, end, days };
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function calculateRates(events: { status: string }[]) {
    const totals = {
        total: 0,
        pass: 0,
        fail: 0,
        retest: 0,
        block: 0,
        conflict: 0,
    };

    for (const e of events) {
        totals.total += 1;
        if (e.status === 'PASS') totals.pass += 1;
        else if (e.status === 'FAIL') totals.fail += 1;
        else if (e.status === 'RETEST') totals.retest += 1;
        else if (e.status === 'BLOCK') totals.block += 1;
        else if (e.status === 'CONFLICT') totals.conflict += 1;
    }

    const rate = (count: number) => (totals.total > 0 ? (count / totals.total) * 100 : 0);
    return {
        total: totals.total,
        passRate: rate(totals.pass),
        failRate: rate(totals.fail),
        retestRate: rate(totals.retest),
        conflictRate: rate(totals.conflict),
    };
}

export class AnalyticsService {
    async getManagementMetrics(projectId: string, userId: string, role: string, timeframe: Timeframe = 'WEEK') {
        await ProjectAccess.check(projectId, userId, role);
        const { start, end, days } = getPeriod(timeframe);
        const prevStart = new Date(start);
        const prevEnd = new Date(end);
        prevStart.setDate(prevStart.getDate() - days);
        prevEnd.setDate(prevEnd.getDate() - days);

        const [currentEvents, previousEvents, automationEvents, distinctTesters] = await Promise.all([
            prisma.executionEvent.findMany({
                where: {
                    projectId,
                    source: 'MANUAL',
                    createdAt: { gte: start, lte: end },
                },
                select: { status: true },
            }),
            prisma.executionEvent.findMany({
                where: {
                    projectId,
                    source: 'MANUAL',
                    createdAt: { gte: prevStart, lte: prevEnd },
                },
                select: { status: true },
            }),
            prisma.automationEvent.findMany({
                where: {
                    projectId,
                    createdAt: { gte: start, lte: end },
                },
                select: { conflict: true },
            }),
            prisma.executionEvent.findMany({
                where: {
                    projectId,
                    source: 'MANUAL',
                    createdAt: { gte: start, lte: end },
                },
                select: { testerId: true },
                distinct: ['testerId'],
            }),
        ]);

        const currentRates = calculateRates(currentEvents);
        const previousRates = calculateRates(previousEvents);
        const conflictRate = automationEvents.length > 0
            ? (automationEvents.filter(e => e.conflict).length / automationEvents.length) * 100
            : 0;

        const qgi = clamp(
            currentRates.passRate
            - currentRates.failRate * 0.5
            - currentRates.retestRate * 0.3
            - conflictRate * 0.2,
            0,
            100
        );

        const testerCount = distinctTesters.filter(t => t.testerId).length || 0;
        const velocity = testerCount > 0 ? currentRates.total / testerCount : currentRates.total;

        // Calculate next actions based on metrics (AI Insights simulation for PM Visibility)
        const nextActions = [];
        if (qgi < 80) {
            nextActions.push({
                type: 'QUALITY_ALERT',
                metric: 'QGI',
                value: qgi,
                suggestion: timeframe === 'SPRINT' 
                    ? 'Current sprint quality is below threshold. Recommend adding a "Bug Bash" session.' 
                    : 'Product quality trend is declining. Consider hardening phase.'
            });
        }
        if (currentRates.failRate > 15) {
            nextActions.push({
                type: 'TEST_FAILURE_ALERT',
                metric: 'Fail Rate',
                value: currentRates.failRate,
                suggestion: 'High failure rate detected. Verify environment stability and regression impacts.'
            });
        }
        if (velocity > 0 && timeframe === 'SPRINT') {
            nextActions.push({
                type: 'PROGRESS_INSIGHT',
                metric: 'Velocity',
                value: velocity,
                suggestion: 'Sprint pace is optimal. Team capacity is well-utilized.'
            });
        }

        return {
            timeframe,
            period: { start, end },
            qgi,
            passRate: currentRates.passRate,
            failRate: currentRates.failRate,
            retestRate: currentRates.retestRate,
            conflictRate,
            velocity,
            defectTrend: currentRates.failRate - previousRates.failRate,
            nextActions
        };
    }

    async getPerformanceMetrics(projectId: string, userId: string, role: string, timeframe: Timeframe = 'WEEK') {
        await ProjectAccess.check(projectId, userId, role);
        const { start, end } = getPeriod(timeframe);

        const events = await prisma.executionEvent.findMany({
            where: {
                projectId,
                source: 'MANUAL',
                createdAt: { gte: start, lte: end },
            },
            select: {
                testerId: true,
                status: true,
                durationMs: true,
                tester: { select: { firstName: true, lastName: true } },
            },
        });

        const byTester: Record<string, any> = {};
        for (const e of events) {
            if (!e.testerId) continue;
            if (!byTester[e.testerId]) {
                byTester[e.testerId] = {
                    testerId: e.testerId,
                    name: `${e.tester?.firstName || ''} ${e.tester?.lastName || ''}`.trim(),
                    total: 0,
                    pass: 0,
                    fail: 0,
                    retest: 0,
                    block: 0,
                    durationTotal: 0,
                    durationCount: 0,
                };
            }
            const row = byTester[e.testerId];
            row.total += 1;
            if (e.status === 'PASS') row.pass += 1;
            else if (e.status === 'FAIL') row.fail += 1;
            else if (e.status === 'RETEST') row.retest += 1;
            else if (e.status === 'BLOCK') row.block += 1;
            if (typeof e.durationMs === 'number') {
                row.durationTotal += e.durationMs;
                row.durationCount += 1;
            }
        }

        return Object.values(byTester).map((row: any) => ({
            testerId: row.testerId,
            name: row.name || 'Unknown',
            total: row.total,
            passRate: row.total > 0 ? (row.pass / row.total) * 100 : 0,
            failRate: row.total > 0 ? (row.fail / row.total) * 100 : 0,
            retestRate: row.total > 0 ? (row.retest / row.total) * 100 : 0,
            blockRate: row.total > 0 ? (row.block / row.total) * 100 : 0,
            velocity: row.total,
            avgDurationMs: row.durationCount > 0 ? Math.round(row.durationTotal / row.durationCount) : 0,
        }));
    }
}

export const analyticsService = new AnalyticsService();
