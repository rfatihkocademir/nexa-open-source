import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { CreateTestRunInput } from '../validations/testRun.validation';
import { testRunExecutionService } from './testRunExecution.service';
import { testRunNotificationService } from './testRunNotification.service';
import { testRunReportService } from './testRunReport.service';
import { testRunLifecycleService } from './testRunLifecycle.service';

export class TestRunService {
    async triggerAutomation(testRunId: string, userId: string, role: string) {
        return testRunExecutionService.triggerAutomation(testRunId, userId, role);
    }

    async triggerItemAutomation(itemId: string, userId: string, role: string) {
        return testRunExecutionService.triggerItemAutomation(itemId, userId, role);
    }

    async create(data: CreateTestRunInput, creatorId: string, role: string) {
        return testRunLifecycleService.create(data, creatorId, role);
    }

    async getAll(
        userId: string,
        role: string,
        projectId?: string,
        isGlobal?: boolean,
        page: number = 1,
        limit: number = 10,
        sortBy: string = 'createdAt',
        sortOrder: 'asc' | 'desc' = 'asc',
        includeArchived: boolean = false
    ) {
        if (!projectId) throw new AppError('projectId is required for listing test runs', 400);
        await ProjectAccess.check(projectId, userId, role);
        const where: any = { projectId };

        if (!includeArchived) {
            // @ts-ignore - Prisma types update lag
            where.deletedAt = null;
        }


        const skip = (page - 1) * limit;

        const [total, testRuns] = await Promise.all([
            prisma.testRun.count({ where }),
            prisma.testRun.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                include: {
                    milestone: { select: { name: true } },
                    creator: { select: { firstName: true, lastName: true } },
                    project: { select: { name: true } },
                    _count: { select: { items: true } },
                },
            })
        ]);

        return {
            data: testRuns,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getById(id: string, userId: string, role: string, itemPage: number = 1, itemLimit: number = 50, includeArchived: boolean = false) {
        const where: any = { id };
        if (!includeArchived) {
            // @ts-ignore - Prisma types update lag
            where.deletedAt = null;
        }
        const testRun = await prisma.testRun.findFirst({
            where,
            include: {
                milestone: { select: { name: true } },
                creator: { select: { firstName: true, lastName: true } },
                project: { select: { name: true } },
            },
        });

        if (!testRun) {
            throw new AppError('Test run not found', 404);
        }

        if (testRun.projectId) {
            await ProjectAccess.check(testRun.projectId, userId, role);
        }

        const [totalItems, items] = await Promise.all([
            prisma.testRunItem.count({ where: { testRunId: id } }),
            prisma.testRunItem.findMany({
                where: { testRunId: id },
                skip: (itemPage - 1) * itemLimit,
                take: itemLimit,
                include: {
                    testCase: { select: { title: true, priority: true, authorId: true } }, // Removed steps for performance
                    assignee: { select: { firstName: true, lastName: true } },
                    results: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            })
        ]);

        return {
            ...testRun,
            items,
            meta: {
                totalItems,
                page: itemPage,
                limit: itemLimit,
                totalPages: Math.ceil(totalItems / itemLimit)
            }
        };
    }

    async archive(id: string, userId: string, role: string) {
        await this.getById(id, userId, role);
        return prisma.testRun.update({
            where: { id },
            // @ts-ignore - Prisma types update lag
            data: { deletedAt: new Date() },
        });
    }

    async restore(id: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({ where: { id } });
        if (!run) {
            throw new AppError('Test run not found', 404);
        }
        if (run.projectId) {
            await ProjectAccess.check(run.projectId, userId, role);
        }

        return prisma.testRun.update({
            where: { id },
            // @ts-ignore - Prisma types update lag
            data: { deletedAt: null },
        });
    }

    async getConflictItems(testRunId: string, userId: string, role: string) {
        return testRunReportService.getConflictItems(testRunId, userId, role);
    }

    async getComparisonReport(testRunId: string, userId: string, role: string) {
        return testRunReportService.getComparisonReport(testRunId, userId, role);
    }

    async notifyCompletion(testRunId: string, userId: string) {
        return testRunNotificationService.notifyCompletion(testRunId, userId);
    }
    async addItems(testRunId: string, testCaseIds: string[], userId: string, role: string) {
        return testRunLifecycleService.addItems(testRunId, testCaseIds, userId, role);
    }

    async createQuickRun(testCaseId: string, userId: string, role: string) {
        return testRunLifecycleService.createQuickRun(testCaseId, userId, role);
    }
    async deleteItem(itemId: string, userId: string, role: string) {
        return testRunLifecycleService.deleteItem(itemId, userId, role);
    }

    async update(id: string, data: Partial<CreateTestRunInput> & { status?: string }, userId: string, role: string) {
        return testRunLifecycleService.update(id, data, userId, role);
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    async getReport(testRunId: string, userId: string, role: string) {
        return testRunReportService.getReport(testRunId, userId, role);
    }
}

export const testRunService = new TestRunService();
