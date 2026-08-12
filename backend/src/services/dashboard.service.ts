import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { WorkItemStatus } from '@prisma/client';

const COMPLETED_BUG_STATUSES: WorkItemStatus[] = [WorkItemStatus.DONE, WorkItemStatus.CLOSED];

export class DashboardService {
    async getMyWorkQueue(userId: string, role: string, organizationId: string) {
        const projectFilter = {
            organizationId,
            ...((role === 'ADMIN' || role === 'admin') ? {} : {
                members: { some: { userId } },
            }),
        };

        const [workItems, testItems] = await Promise.all([
            prisma.workItem.findMany({
                where: {
                    assigneeId: userId,
                    deletedAt: null,
                    status: { notIn: ['DONE', 'CLOSED'] },
                    project: projectFilter,
                },
                orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
                take: 8,
                select: {
                    id: true,
                    key: true,
                    title: true,
                    itemType: true,
                    status: true,
                    priority: true,
                    updatedAt: true,
                    project: { select: { key: true, name: true } },
                },
            }),
            prisma.testRunItem.findMany({
                where: {
                    assigneeId: userId,
                    finalStatus: { in: ['UNTESTED', 'FAIL', 'BLOCK', 'RETEST'] },
                    testRun: {
                        status: 'OPEN',
                        deletedAt: null,
                        project: projectFilter,
                    },
                },
                orderBy: { testRun: { dueDate: 'asc' } },
                take: 8,
                select: {
                    id: true,
                    caseTitle: true,
                    casePriority: true,
                    finalStatus: true,
                    testRun: {
                        select: {
                            key: true,
                            title: true,
                            dueDate: true,
                            project: { select: { key: true, name: true } },
                        },
                    },
                },
            }),
        ]);

        return { workItems, testItems };
    }

    async getExecutionSummary(userId: string, role: string, organizationId: string) {
        const projectFilter = {
            organizationId,
            ...((role === 'ADMIN' || role === 'admin') ? {} : {
                members: { some: { userId } },
            }),
        };
        const totals = await prisma.testRun.aggregate({
            where: { project: projectFilter },
            _sum: {
                passedCount: true,
                failedCount: true,
                blockedCount: true,
                untestedCount: true,
            },
        });
        return {
            passed: totals._sum.passedCount ?? 0,
            failed: totals._sum.failedCount ?? 0,
            blocked: totals._sum.blockedCount ?? 0,
            skipped: totals._sum.untestedCount ?? 0,
        };
    }

    async getWorkspaceOverview(userId: string, role: string, organizationId: string) {
        const projectWhere = {
            status: 'ACTIVE' as const,
            organizationId,
            ...((role === 'ADMIN' || role === 'admin') ? {} : {
                members: { some: { userId } },
            }),
        };

        const projects = await prisma.project.findMany({
            where: projectWhere,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                key: true,
                name: true,
                _count: {
                    select: {
                        testRuns: true,
                        suites: { where: { deletedAt: null, parentId: null } },
                    },
                },
            },
        });

        const projectIds = projects.map((project) => project.id);
        if (projectIds.length === 0) {
            return { projects: [], totals: { projects: 0, suites: 0, testRuns: 0, members: 0 } };
        }

        const members = await prisma.projectMember.findMany({
            where: { projectId: { in: projectIds } },
            distinct: ['userId'],
            select: { userId: true },
        });

        return {
            projects,
            totals: {
                projects: projects.length,
                suites: projects.reduce((sum, project) => sum + project._count.suites, 0),
                testRuns: projects.reduce((sum, project) => sum + project._count.testRuns, 0),
                members: members.length,
            },
        };
    }

    async getProjectStats(projectId: string) {
        // Check if project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        // --- REAL-TIME ANALYTICS INTEGRATION ---
        // Get period for metrics (default WEEK)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);

        // Fetch execution events for metrics
        const [executionEvents, automationEvents, testCasesWithSuites] = await Promise.all([
            prisma.executionEvent.findMany({
                where: { projectId, createdAt: { gte: start, lte: end } },
                select: { status: true, testerId: true }
            }),
            prisma.automationEvent.findMany({
                where: { projectId, createdAt: { gte: start, lte: end } },
                select: { conflict: true }
            }),
            prisma.testCase.findMany({
                where: { suite: { projectId }, deletedAt: null },
                select: { workItemId: true }
            })
        ]);

        // Calculate pass rate
        const totalExecutions = executionEvents.length;
        const passCount = executionEvents.filter(e => e.status === 'PASS').length;
        const failCount = executionEvents.filter(e => e.status === 'FAIL').length;
        const retestCount = executionEvents.filter(e => e.status === 'RETEST').length;
        const passRate = totalExecutions > 0 ? (passCount / totalExecutions) * 100 : 0;

        // Calculate conflict rate (from automation)
        const conflictCount = automationEvents.filter(e => e.conflict).length;
        const conflictRate = automationEvents.length > 0 ? (conflictCount / automationEvents.length) * 100 : 0;

        // Calculate QGI (Quality Gate Index)
        const qgi = Math.max(0, Math.min(100,
            passRate 
            - (totalExecutions > 0 ? (failCount / totalExecutions) * 50 : 0)
            - (totalExecutions > 0 ? (retestCount / totalExecutions) * 30 : 0)
            - conflictRate * 0.2
        ));

        // Calculate Velocity (Average executions per tester)
        const distinctTesters = new Set(executionEvents.map(e => e.testerId).filter(Boolean)).size;
        const velocity = distinctTesters > 0 ? totalExecutions / distinctTesters : totalExecutions;

        // Calculate Coverage (Test cases linked to work items)
        const totalTestCasesCount = testCasesWithSuites.length;
        const linkedTestCasesCount = testCasesWithSuites.filter(tc => tc.workItemId).length;
        const coverage = totalTestCasesCount > 0 ? (linkedTestCasesCount / totalTestCasesCount) * 100 : 0;

        // Calculate Stability (100 - volatility of results)
        // Simple heuristic: stability decreases with high retest or failure rates
        const stability = totalExecutions > 0 ? Math.max(0, 100 - (failCount + retestCount) / totalExecutions * 100) : 100;


        // 1. Parallel batch fetch for all SDLC, Bug, and Test metrics
        const [
            activeSprint,
            pastSprints,
            totalStories,
            storiesByStatus,
            totalBugs,
            openBugs,
            bugsBySeverity,
            bugsByStatus,
            totalTestCases,
            testCasesByStatus,
            totalTestRuns,
            activeTestRuns,
            executionStats
        ] = await Promise.all([
            prisma.sprint.findFirst({
                where: { projectId, status: 'ACTIVE' },
                include: {
                    workItems: {
                        select: { storyPoints: true, status: true }
                    }
                }
            }),
            prisma.sprint.findMany({
                where: { projectId, status: 'CLOSED' },
                orderBy: { endDate: 'asc' },
                take: 5,
                include: {
                    workItems: {
                        select: { storyPoints: true, status: true }
                    }
                }
            }),
            prisma.workItem.count({ where: { projectId, itemType: 'STORY', deletedAt: null } }),
            prisma.workItem.groupBy({
                by: ['status'],
                where: { projectId, itemType: 'STORY', deletedAt: null },
                _count: { status: true }
            }),
            prisma.workItem.count({ where: { projectId, itemType: 'BUG', deletedAt: null } }),
            prisma.workItem.count({
                where: {
                    projectId,
                    itemType: 'BUG',
                    status: { notIn: COMPLETED_BUG_STATUSES },
                    deletedAt: null,
                },
            }),
            prisma.workItem.groupBy({
                by: ['severity'],
                where: {
                    projectId,
                    itemType: 'BUG',
                    status: { notIn: COMPLETED_BUG_STATUSES },
                    deletedAt: null,
                },
                _count: { severity: true }
            }),
            prisma.workItem.groupBy({
                by: ['status'],
                where: { projectId, itemType: 'BUG', deletedAt: null },
                _count: { status: true }
            }),
            prisma.testCase.count({
                where: {
                    suite: { projectId },
                    deletedAt: null
                },
            }),
            prisma.testCase.groupBy({
                by: ['status'],
                where: {
                    suite: { projectId },
                    deletedAt: null
                },
                _count: { status: true },
            }),
            prisma.testRun.count({
                where: { projectId },
            }),
            prisma.testRun.count({
                where: { projectId, status: 'OPEN' },
            }),
            prisma.testRunItem.groupBy({
                by: ['finalStatus'],
                where: { testRun: { projectId } },
                _count: { finalStatus: true },
            })
        ]);

        let sprintStats = null;
        if (activeSprint) {
            const totalPoints = activeSprint.workItems.reduce((sum: number, s: any) => sum + (s.storyPoints || 0), 0);
            const completedPoints = activeSprint.workItems
                .filter((s: any) => s.status === 'DONE')
                .reduce((sum: number, s: any) => sum + (s.storyPoints || 0), 0);

            sprintStats = {
                id: activeSprint.id,
                name: activeSprint.name,
                goal: activeSprint.goal,
                startDate: activeSprint.startDate,
                endDate: activeSprint.endDate,
                totalPoints,
                completedPoints,
                progress: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
                daysRemaining: activeSprint.endDate
                    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
                    : 0
            };
        }

        const velocityHistory = pastSprints.map(sprint => {
            const totalPoints = sprint.workItems.reduce((sum: number, s: any) => sum + (s.storyPoints || 0), 0);
            const completedPoints = sprint.workItems
                .filter((s: any) => s.status === 'DONE')
                .reduce((sum: number, s: any) => sum + (s.storyPoints || 0), 0);
            return {
                name: sprint.name,
                completedPoints,
                totalPoints
            };
        });

        // Format response
        return {
            sprint: sprintStats,
            velocityHistory,
            workItems: {
                total: totalStories,
                byStatus: storiesByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
            },
            bugs: {
                total: totalBugs,
                openTotal: openBugs,
                bySeverity: bugsBySeverity.reduce((acc, curr) => ({ ...acc, [curr.severity || 'UNKNOWN']: curr._count.severity }), {}),
                byStatus: bugsByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
            },
            testCases: {
                total: totalTestCases,
                byStatus: testCasesByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.status }), {}),
            },
            testRuns: {
                total: totalTestRuns,
                active: activeTestRuns,
            },
            execution: {
                byStatus: executionStats.reduce((acc, curr) => ({ ...acc, [curr.finalStatus]: curr._count.finalStatus }), {}),
                qgi: Math.round(qgi),
                velocity: Math.round(velocity * 10) / 10,
                passRate: Math.round(passRate),
                coverage: Math.round(coverage),
                stability: Math.round(stability),
            },
        };
    }

    async getRecentActivities(userId: string, role: string, organizationId: string) {
        // Get user's accessible projects
        let projectIds: string[];
        if (role === 'ADMIN') {
            const projects = await prisma.project.findMany({ where: { organizationId }, select: { id: true } });
            projectIds = projects.map(p => p.id);
        } else {
            const memberships = await prisma.projectMember.findMany({
                where: { userId, project: { organizationId } },
                select: { projectId: true },
            });
            projectIds = memberships.map(m => m.projectId);
        }

        if (projectIds.length === 0) return [];

        // Fetch recent test runs
        const recentRuns = await prisma.testRun.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                creator: { select: { firstName: true, lastName: true } },
                project: { select: { name: true } },
            },
        });

        // Fetch recent test results
        const recentResults = await prisma.testResult.findMany({
            where: {
                runItem: { testRun: { projectId: { in: projectIds } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                tester: { select: { firstName: true, lastName: true } },
                runItem: {
                    select: {
                        caseTitle: true,
                        testRun: { select: { title: true, project: { select: { name: true } } } },
                    },
                },
            },
        });

        // Fetch recent test case changes
        const recentChanges = await prisma.testCaseHistory.findMany({
            where: {
                testCase: { suite: { projectId: { in: projectIds } } },
            },
            orderBy: { changedAt: 'desc' },
            take: 5,
            include: {
                changedBy: { select: { firstName: true, lastName: true } },
                testCase: {
                    select: {
                        title: true,
                        suite: { select: { project: { select: { name: true } } } },
                    },
                },
            },
        });

        // Merge and sort all activities by date
        type Activity = {
            id: string;
            type: 'RUN_CREATED' | 'TEST_EXECUTED' | 'CASE_UPDATED';
            description: string;
            user: string;
            project: string;
            timestamp: Date;
            meta?: Record<string, unknown>;
        };

        const activities: Activity[] = [];

        for (const run of recentRuns) {
            activities.push({
                id: run.id,
                type: 'RUN_CREATED',
                description: run.title,
                user: `${run.creator.firstName} ${run.creator.lastName}`,
                project: run.project?.name || '',
                timestamp: run.createdAt,
                meta: { status: run.status, totalItems: run.totalItems },
            });
        }

        for (const result of recentResults) {
            activities.push({
                id: result.id,
                type: 'TEST_EXECUTED',
                description: result.runItem.caseTitle || '',
                user: `${result.tester.firstName} ${result.tester.lastName}`,
                project: result.runItem.testRun.project?.name || '',
                timestamp: result.createdAt,
                meta: { status: result.status, runTitle: result.runItem.testRun.title },
            });
        }

        for (const change of recentChanges) {
            activities.push({
                id: change.id,
                type: 'CASE_UPDATED',
                description: change.title,
                user: `${change.changedBy.firstName} ${change.changedBy.lastName}`,
                project: change.testCase.suite.project?.name || '',
                timestamp: change.changedAt,
                meta: { version: change.version },
            });
        }

        // Sort by timestamp descending and take top 10
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return activities.slice(0, 10);
    }

    async globalSearch(query: string, userId: string, role: string, organizationId: string) {
        if (!query || query.trim().length < 2) return [];

        const q = query.trim();

        // Get accessible project IDs
        let projectIds: string[];
        if (role === 'ADMIN') {
            const projects = await prisma.project.findMany({ where: { organizationId }, select: { id: true } });
            projectIds = projects.map(p => p.id);
        } else {
            const memberships = await prisma.projectMember.findMany({
                where: { userId, project: { organizationId } },
                select: { projectId: true },
            });
            projectIds = memberships.map(m => m.projectId);
        }

        // Run all searches in parallel
        const [projects, suites, cases, runs, milestones, workItems] = await Promise.all([
            // Projects
            prisma.project.findMany({
                where: {
                    id: { in: projectIds },
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { key: { contains: q, mode: 'insensitive' } },
                    ],
                    status: 'ACTIVE',
                },
                take: 5,
                select: { id: true, key: true, name: true, description: true },
            }),
            // Test Suites
            prisma.testSuite.findMany({
                where: {
                    projectId: { in: projectIds },
                    name: { contains: q, mode: 'insensitive' },
                    deletedAt: null,
                },
                take: 5,
                select: {
                    id: true, name: true, projectId: true,
                    project: { select: { key: true, name: true } },
                },
            }),
            // Test Cases
            prisma.testCase.findMany({
                where: {
                    suite: { projectId: { in: projectIds } },
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { key: { contains: q, mode: 'insensitive' } },
                    ],
                    deletedAt: null,
                },
                take: 5,
                select: {
                    id: true, key: true, title: true, priority: true,
                    suite: { select: { id: true, name: true, projectId: true, project: { select: { key: true, name: true } } } },
                },
            }),
            // Test Runs
            prisma.testRun.findMany({
                where: {
                    projectId: { in: projectIds },
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { key: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: 5,
                select: {
                    id: true, key: true, title: true, status: true,
                    project: { select: { name: true } },
                },
            }),
            // Milestones
            prisma.milestone.findMany({
                where: {
                    projectId: { in: projectIds },
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { key: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: 5,
                select: {
                    id: true, key: true, name: true, status: true,
                    project: { select: { name: true } },
                },
            }),
            // Work items and bugs
            prisma.workItem.findMany({
                where: {
                    projectId: { in: projectIds },
                    deletedAt: null,
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { key: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: 8,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    key: true,
                    title: true,
                    itemType: true,
                    status: true,
                    priority: true,
                    project: { select: { key: true, name: true } },
                },
            }),
        ]);

        type SearchResult = {
            id: string;
            type: 'PROJECT' | 'SUITE' | 'CASE' | 'RUN' | 'MILESTONE' | 'WORK_ITEM';
            name: string;
            detail?: string;
            path: string;
            meta?: Record<string, unknown>;
        };

        const results: SearchResult[] = [];

        for (const p of projects) {
            results.push({
                id: p.id,
                type: 'PROJECT',
                name: p.name,
                detail: p.description || undefined,
                path: `/p/${encodeURIComponent(p.key)}`,
                meta: { key: p.key },
            });
        }

        for (const s of suites) {
            results.push({
                id: s.id,
                type: 'SUITE',
                name: s.name,
                detail: s.project.name,
                path: `/p/${encodeURIComponent(s.project.key)}/tests?suite=${s.id}`,
            });
        }

        for (const c of cases) {
            results.push({
                id: c.id,
                type: 'CASE',
                name: c.title,
                detail: `${c.suite.project.name} / ${c.suite.name}`,
                path: `/b/${encodeURIComponent(c.key)}`,
                meta: { key: c.key, priority: c.priority },
            });
        }

        for (const r of runs) {
            results.push({
                id: r.id,
                type: 'RUN',
                name: r.title,
                detail: r.project?.name || 'Global',
                path: `/b/${encodeURIComponent(r.key)}`,
                meta: { key: r.key, status: r.status },
            });
        }

        for (const m of milestones) {
            results.push({
                id: m.id,
                type: 'MILESTONE',
                name: m.name,
                detail: m.project?.name,
                path: `/b/${encodeURIComponent(m.key)}`,
                meta: { key: m.key, status: m.status },
            });
        }

        for (const item of workItems) {
            results.push({
                id: item.id,
                type: 'WORK_ITEM',
                name: item.title,
                detail: `${item.project.name} · ${item.key}`,
                path: `/b/${encodeURIComponent(item.key)}`,
                meta: {
                    key: item.key,
                    itemType: item.itemType,
                    status: item.status,
                    priority: item.priority,
                },
            });
        }

        return results;
    }
}

export const dashboardService = new DashboardService();
