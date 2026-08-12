import { Prisma, WorkItemType, ResultStatus, CaseStatus, Priority } from '@prisma/client';
import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';

export interface TraceabilityTestCase {
    id: string;
    title: string;
    status: CaseStatus;
    lastExecution: {
        status: ResultStatus;
        executedAt: Date;
        runId: string;
    } | null;
    bugs: Array<{
        id: string;
        title: string;
        priority: Priority;
    }>;
}

export interface TraceabilityStory {
    id: string;
    title: string;
    status: string;
    priority: Priority;
    bugs: Array<{
        id: string;
        title: string;
        priority: Priority;
    }>;
    testCases: TraceabilityTestCase[];
}

export interface TraceabilityEpic {
    id: string;
    title: string;
    stories: TraceabilityStory[];
}

// Define the complex internal type for Prisma include
type WorkItemWithChildrenAndTests = Prisma.WorkItemGetPayload<{
    include: {
        children: {
            include: {
                testCases: {
                    include: {
                        runItems: {
                            include: {
                                testRun: { select: { createdAt: true } },
                                results: {
                                    include: { bugs: true }
                                }
                            }
                        }
                    }
                },
                children: true
            }
        }
    }
}>;

export class TraceabilityService {
    async getTraceabilityMatrix(projectId: string, userId: string, role: string, filters?: { sprintId?: string; parentId?: string }): Promise<TraceabilityEpic[]> {
        await ProjectAccess.check(projectId, userId, role);

        const whereClause: Prisma.WorkItemWhereInput = { projectId };

        if (filters?.parentId && filters.parentId !== 'all') {
            whereClause.id = filters.parentId;
        }

        const epics = await prisma.workItem.findMany({
            where: { ...whereClause, itemType: 'EPIC' },
            include: {
                children: {
                    where: filters?.sprintId && filters.sprintId !== 'all' ? { sprintId: filters.sprintId } : undefined,
                    include: {
                        testCases: {
                            include: {
                                runItems: {
                                    include: {
                                        testRun: {
                                            select: { createdAt: true }
                                        },
                                        results: {
                                            take: 1,
                                            orderBy: { createdAt: 'desc' },
                                            include: {
                                                bugs: true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        children: { where: { itemType: "BUG" } },
                    }
                }
            }
        }) as WorkItemWithChildrenAndTests[];

        return epics.map(epic => this.formatEpic(epic));
    }

    private formatEpic(epic: WorkItemWithChildrenAndTests): TraceabilityEpic {
        return {
            id: epic.id,
            title: epic.title,
            stories: (epic.children || []).map(story => this.formatStory(story as any))
        };
    }

    private formatStory(story: any): TraceabilityStory {
        return {
            id: story.id,
            title: story.title,
            status: story.status as string,
            priority: story.priority,
            bugs: (story.children || [])
                .filter((child: any) => child.itemType === 'BUG')
                .map((bug: any) => ({
                    id: bug.id,
                    title: bug.title,
                    priority: bug.priority
                })),
            testCases: (story.testCases || []).map((tc: any) => this.formatTestCase(tc))
        };
    }

    private formatTestCase(tc: any): TraceabilityTestCase {
        const allResults = tc.runItems.flatMap((ri: any) => ri.results.map((r: any) => ({
            ...r,
            runId: ri.testRunId,
            runDate: ri.testRun?.createdAt
        })));

        allResults.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const latestResult = allResults[0];

        const relatedBugsMap = new Map();
        allResults.forEach((r: any) => {
            if (r.bugs && r.bugs.length > 0) {
                r.bugs.forEach((b: any) => relatedBugsMap.set(b.id, {
                    id: b.id,
                    title: b.title,
                    priority: b.priority
                }));
            }
        });

        return {
            id: tc.id,
            title: tc.title,
            status: tc.status as CaseStatus,
            lastExecution: latestResult ? {
                status: latestResult.status,
                executedAt: latestResult.createdAt,
                runId: latestResult.runId
            } : null,
            bugs: Array.from(relatedBugsMap.values())
        };
    }

    async getCoverageStatistics(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const totalStories = await prisma.workItem.count({ where: { projectId, itemType: WorkItemType.STORY } });
        const designedStories = await prisma.workItem.count({
            where: {
                projectId,
                itemType: WorkItemType.STORY,
                testCases: { some: {} }
            }
        });
        const approvedStories = await prisma.workItem.count({
            where: {
                projectId,
                itemType: WorkItemType.STORY,
                testCases: { some: { status: 'APPROVED', deletedAt: null } },
            },
        });

        const coverageRate = totalStories > 0 ? (approvedStories / totalStories) * 100 : 0;

        return {
            totalStories,
            coveredStories: approvedStories,
            designedStories,
            approvedStories,
            coverageRate: Math.round(coverageRate * 100) / 100
        };
    }

    async getTraceabilityGaps(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const storiesWithoutTests = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: WorkItemType.STORY,
                testCases: { none: {} }
            },
            select: { id: true, title: true, status: true }
        });

        const bugsWithoutOrigin = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: WorkItemType.BUG,
                testResultId: null,
                foundInEnvId: null
            },
            select: { id: true, title: true, status: true }
        });

        const orphanTestCases = await prisma.testCase.findMany({
            where: {
                suite: { projectId },
                workItemId: null,
                deletedAt: null
            },
            select: { id: true, title: true, status: true }
        });

        return {
            storiesWithoutTests,
            bugsWithoutOrigin,
            orphanTestCases,
            totalGaps: storiesWithoutTests.length + bugsWithoutOrigin.length + orphanTestCases.length
        };
    }

    /**
     * Gate-level assertion: Blocks release if critical traceability gaps exist.
     * Checks that all stories in scope have test coverage and all bugs have origin.
     */
    async assertTraceabilityComplete(releaseId: string, projectId: string): Promise<{ complete: boolean; blockers: string[] }> {
        const blockers: string[] = [];

        // Get all work items linked to this release (via sprint or direct follow-ups)
        const release = await prisma.releaseCandidate.findUnique({
            where: { id: releaseId },
            select: { sprintId: true },
        });

        const scopeFilter: any = { projectId };
        if (release?.sprintId) {
            scopeFilter.sprintId = release.sprintId;
        }

        // Stories in scope without test cases
        const untestedStories = await prisma.workItem.count({
            where: {
                ...scopeFilter,
                itemType: WorkItemType.STORY,
                status: { notIn: ['BACKLOG', 'CLOSED'] },
                testCases: { none: {} },
            },
        });

        if (untestedStories > 0) {
            blockers.push(`${untestedStories} story/stories in scope have no linked test cases.`);
        }

        // Bugs without traceability origin
        const untracedBugs = await prisma.workItem.count({
            where: {
                ...scopeFilter,
                itemType: WorkItemType.BUG,
                status: { notIn: ['CLOSED'] },
                testResultId: null,
                foundInEnvId: null,
            },
        });

        if (untracedBugs > 0) {
            blockers.push(`${untracedBugs} bug(s) have no origin (no linked test result or environment).`);
        }

        // Orphan test cases (no workItem link) in project
        const orphanCases = await prisma.testCase.count({
            where: {
                suite: { projectId },
                workItemId: null,
                deletedAt: null,
                status: 'APPROVED',
            },
        });

        if (orphanCases > 0) {
            blockers.push(`${orphanCases} approved test case(s) are not linked to any work item (orphans).`);
        }

        return {
            complete: blockers.length === 0,
            blockers,
        };
    }

    /**
     * Comprehensive orphan artifact scan for a project.
     * Returns all entities that lack required trace links.
     */
    async scanOrphanArtifacts(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        // WorkItems without parent Epic (only STORY/TASK types)
        const orphanWorkItems = await prisma.workItem.findMany({
            where: {
                projectId,
                itemType: { in: ['STORY', 'TASK'] },
                parentId: null,
            },
            select: { id: true, title: true, itemType: true, status: true },
        });

        // TestCases without WorkItem
        const orphanTestCases = await prisma.testCase.findMany({
            where: {
                suite: { projectId },
                workItemId: null,
                deletedAt: null,
            },
            select: { id: true, title: true, status: true },
        });

        // WikiPages without any linked WorkItems
        const orphanWikiPages = await prisma.wikiPage.findMany({
            where: {
                space: { projectId },
                workItems: { none: {} },
            },
            select: { id: true, title: true },
        });

        return {
            orphanWorkItems,
            orphanTestCases,
            orphanWikiPages,
            totalOrphans: orphanWorkItems.length + orphanTestCases.length + orphanWikiPages.length,
        };
    }
}
