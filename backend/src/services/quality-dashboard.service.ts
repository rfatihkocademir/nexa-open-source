import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';

export class QualityDashboardService {
    async getDashboardMetrics(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const [
            rootCauseDistribution,
            rootCauseBugs,
            defectLeakage,
            traceability,
            reopenRate,
            mttr,
            releaseReadiness
        ] = await Promise.all([
            this.getRootCauseDistribution(projectId),
            this.getRootCauseBugs(projectId),
            this.getDefectLeakage(projectId),
            this.getTraceabilityCoverage(projectId),
            this.getReopenRate(projectId),
            this.getMttrTrend(projectId),
            this.getReleaseReadiness(projectId)
        ]);

        return {
            rootCauseDistribution,
            rootCauseBugs,
            defectLeakage,
            traceability,
            reopenRate,
            mttr,
            releaseReadiness
        };
    }

    private async getRootCauseDistribution(projectId: string) {
        const bugs = await prisma.workItem.groupBy({
            by: ['rootCause'],
            where: {
                projectId,
                itemType: { in: ['BUG', 'DEFECT'] },
                deletedAt: null
            },
            _count: {
                _all: true
            }
        });

        return bugs.map(b => ({
            rootCause: b.rootCause || 'UNASSIGNED',
            count: b._count._all
        }));
    }

    private async getRootCauseBugs(projectId: string) {
        const bugs = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: { in: ['BUG', 'DEFECT'] },
                deletedAt: null
            },
            select: {
                id: true,
                key: true,
                title: true,
                severity: true,
                status: true,
                rootCause: true,
                updatedAt: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        return bugs.map(bug => ({
            ...bug,
            rootCause: bug.rootCause || 'UNASSIGNED'
        }));
    }

    private async getDefectLeakage(projectId: string) {
        // Find bugs grouped by foundInEnvId
        const bugs = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: { in: ['BUG', 'DEFECT'] },
                deletedAt: null
            },
            select: {
                id: true,
                severity: true,
                foundInEnvId: true,
                foundInEnv: { select: { name: true } }
            }
        });

        const leakageMap: Record<string, { envName: string; total: number; high: number; low: number }> = {};
        
        for (const bug of bugs) {
            const envId = bug.foundInEnvId || 'UNKNOWN';
            const envName = (bug as any).foundInEnv?.name || 'Bilinmiyor';
            
            if (!leakageMap[envId]) {
                leakageMap[envId] = { envName, total: 0, high: 0, low: 0 };
            }
            
            leakageMap[envId].total += 1;
            if (bug.severity === 'HIGH' || bug.severity === 'CRITICAL') {
                leakageMap[envId].high += 1;
            } else {
                leakageMap[envId].low += 1;
            }
        }

        return Object.values(leakageMap).sort((a, b) => b.total - a.total);
    }

    private async getTraceabilityCoverage(projectId: string) {
        const stories = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: 'STORY',
                deletedAt: null
            },
            select: {
                id: true,
                _count: {
                    select: { testCases: true }
                }
            }
        });

        const totalStories = stories.length;
        const storiesWithTests = stories.filter(s => s._count.testCases > 0).length;
        
        const coveragePercentage = totalStories > 0 ? Math.round((storiesWithTests / totalStories) * 100) : 0;
        
        return {
            totalStories,
            storiesWithTests,
            coveragePercentage
        };
    }

    private async getReopenRate(projectId: string) {
        // Count audit logs where a work item went from QA/DONE to IN_PROGRESS
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const audits = await prisma.auditLog.findMany({
            where: {
                projectId,
                action: 'UPDATE',
                entityType: 'WorkItem',
                createdAt: { gte: thirtyDaysAgo }
            },
            select: {
                id: true,
                before: true,
                after: true
            }
        });

        let totalTransitions = 0;
        let reopenCount = 0;

        for (const audit of audits) {
            const prev = audit.before as Record<string, any>;
            const next = audit.after as Record<string, any>;

            if (prev?.status && next?.status && prev.status !== next.status) {
                totalTransitions++;
                const isReopen = (prev.status === 'QA' || prev.status === 'DONE') && 
                                 (next.status === 'IN_PROGRESS' || next.status === 'TODO');
                if (isReopen) reopenCount++;
            }
        }

        const reopenRate = totalTransitions > 0 ? parseFloat(((reopenCount / totalTransitions) * 100).toFixed(1)) : 0;

        return {
            totalTransitions,
            reopenCount,
            reopenRate
        };
    }

    private async getMttrTrend(projectId: string) {
        // MTTR (Mean Time to Resolve) Trend for the last 4 weeks.
        const bugs = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: { in: ['BUG', 'DEFECT'] },
                status: 'DONE',
                deletedAt: null
            },
            select: {
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'asc'
            }
        });

        // Group by week (just roughly by the end date week)
        const weeklyMttr: Record<string, { totalHours: number; count: number }> = {};
        
        for (const bug of bugs) {
            // week string YYYY-WW (simplified to just date string for this example)
            const dateStr = bug.updatedAt.toISOString().split('T')[0];
            const diffHours = (bug.updatedAt.getTime() - bug.createdAt.getTime()) / (1000 * 60 * 60);
            
            if (!weeklyMttr[dateStr]) {
                weeklyMttr[dateStr] = { totalHours: 0, count: 0 };
            }
            weeklyMttr[dateStr].totalHours += diffHours;
            weeklyMttr[dateStr].count += 1;
        }

        // Just return the last 10 days of resolved bugs as a trend
        const trend = Object.entries(weeklyMttr).slice(-10).map(([date, data]) => ({
            date,
            avgHours: Math.round(data.totalHours / data.count)
        }));

        return trend;
    }

    private async getReleaseReadiness(projectId: string) {
        const latestReleases = await prisma.releaseCandidate.findMany({
            where: {
                projectId,
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
                id: true,
                title: true,
                status: true,
                readinessScore: true,
                createdAt: true
            }
        });
        
        return latestReleases;
    }
}

export const qualityDashboardService = new QualityDashboardService();
