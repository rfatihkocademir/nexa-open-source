import prisma from "../utils/prisma";
import { CreateWorklogInput, UpdateWorklogInput, WorklogFilters } from "../types/worklog";
import { ProjectAccess } from "../utils/projectAccess";
import { AppError } from "../utils/AppError";
import { parseWorklogDuration } from "../utils/worklogDuration";

export class WorklogService {
    static async create(userId: string, role: string, input: CreateWorklogInput) {
        const durationMinutes = parseWorklogDuration(input.duration ?? input.durationMinutes);
        if (durationMinutes === null) {
            throw new AppError("Duration must be a positive Jira-style duration, for example 15m or 1h 30m", 400);
        }

        // Resolve project ID if missing
        let projectId = input.projectId;
        let workItemId = input.workItemId;

        if (workItemId) {
            // Accept both the canonical WorkItem UUID and the human-facing
            // issue key. The database relation must always receive the UUID.
            const workItem = await prisma.workItem.findFirst({
                where: { OR: [{ id: workItemId }, { key: workItemId }] },
                select: { id: true, projectId: true },
            });
            if (!workItem) {
                throw new AppError("Linked work item does not exist", 400);
            }
            workItemId = workItem.id;
            if (!projectId) projectId = workItem.projectId;
            if (projectId !== workItem.projectId) {
                throw new AppError("Work item and project do not match", 400);
            }
        }

        if (projectId) {
            await ProjectAccess.check(projectId, userId, role);
        }

        return await prisma.worklog.create({
            data: {
                startedAt: input.startedAt,
                durationMinutes,
                description: input.description,
                category: input.category,
                billable: input.billable,
                workItemId,
                userId,
                projectId
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                workItem: { select: { id: true, title: true } }
            }
        });
    }

    static async getById(id: string) {
        const worklog = await prisma.worklog.findFirst({
            where: { id, deletedAt: null },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                workItem: { select: { id: true, title: true } }
            }
        });
        if (!worklog) throw new AppError("Worklog not found", 404);
        return worklog;
    }

    static async getAll(userId: string, role: string, filters?: WorklogFilters) {
        if (filters?.projectId) {
            await ProjectAccess.check(filters.projectId, userId, role);
        }

        const where: any = { deletedAt: null };
        if (filters?.projectId) where.projectId = filters.projectId;
        if (filters?.userId) where.userId = filters.userId;
        if (filters?.workItemId) where.workItemId = filters.workItemId;

        if (filters?.from || filters?.to) {
            where.startedAt = {};
            if (filters.from) where.startedAt.gte = new Date(filters.from);
            if (filters.to) where.startedAt.lte = new Date(filters.to);
        }

        if (role !== 'ADMIN' && !filters?.projectId && userId !== filters?.userId) {
            where.userId = userId;
        }

        return await prisma.worklog.findMany({
            where,
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                workItem: { select: { id: true, title: true } }
            },
            orderBy: { startedAt: 'desc' }
        });
    }

    static async getWeeklySummary(userId: string, role: string, projectId: string, weekStart?: string) {
        await ProjectAccess.check(projectId, userId, role);
        const start = weekStart ? new Date(weekStart) : new Date();
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const [members, logs] = await Promise.all([
            prisma.projectMember.findMany({
                where: { projectId },
                select: { userId: true, weeklyCapacityMinutes: true, user: { select: { firstName: true, lastName: true } } },
            }),
            prisma.worklog.findMany({
                where: { projectId, deletedAt: null, startedAt: { gte: start, lt: end } },
                select: { userId: true, durationMinutes: true, category: true, billable: true },
            }),
        ]);
        return members.map((member) => {
            const memberLogs = logs.filter((log) => log.userId === member.userId);
            const byCategory = memberLogs.reduce<Record<string, number>>((totals, log) => {
                totals[log.category] = (totals[log.category] || 0) + log.durationMinutes;
                return totals;
            }, {});
            const loggedMinutes = memberLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
            return {
                userId: member.userId,
                name: `${member.user.firstName} ${member.user.lastName}`.trim(),
                capacityMinutes: member.weeklyCapacityMinutes,
                loggedMinutes,
                remainingMinutes: member.weeklyCapacityMinutes - loggedMinutes,
                billableMinutes: memberLogs.filter((log) => log.billable).reduce((sum, log) => sum + log.durationMinutes, 0),
                byCategory,
            };
        });
    }

    static async getTimesheetData(userId: string, role: string, projectId: string, startDateStr: string, endDateStr: string) {
        await ProjectAccess.check(projectId, userId, role);
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);

        const logs = await prisma.worklog.findMany({
            where: {
                projectId,
                deletedAt: null,
                startedAt: { gte: start, lte: end }
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                workItem: { select: { id: true, title: true, key: true, itemType: true } }
            },
            orderBy: { startedAt: 'asc' }
        });

        const matrix: Record<string, {
            user: { id: string; name: string };
            items: Record<string, {
                workItem: { id: string; title: string; key: string; itemType: string };
                dailyLogs: Record<string, number>;
                totalMinutes: number;
            }>;
            totalMinutes: number;
        }> = {};

        for (const log of logs) {
            const uid = log.userId;
            const wid = log.workItemId || 'unassigned';
            const dateStr = log.startedAt.toISOString().split('T')[0];

            if (!matrix[uid]) {
                matrix[uid] = {
                    user: { id: uid, name: `${log.user.firstName} ${log.user.lastName}`.trim() },
                    items: {},
                    totalMinutes: 0
                };
            }

            if (!matrix[uid].items[wid]) {
                matrix[uid].items[wid] = {
                    workItem: log.workItem ? {
                        id: log.workItem.id,
                        title: log.workItem.title,
                        key: log.workItem.key || '',
                        itemType: log.workItem.itemType
                    } : { id: 'unassigned', title: 'Bağlantısız Süre (Genel)', key: '', itemType: 'TASK' },
                    dailyLogs: {},
                    totalMinutes: 0
                };
            }

            matrix[uid].items[wid].dailyLogs[dateStr] = (matrix[uid].items[wid].dailyLogs[dateStr] || 0) + log.durationMinutes;
            matrix[uid].items[wid].totalMinutes += log.durationMinutes;
            matrix[uid].totalMinutes += log.durationMinutes;
        }

        return Object.values(matrix).map(m => ({
            user: m.user,
            totalMinutes: m.totalMinutes,
            items: Object.values(m.items)
        }));
    }

    static async update(userId: string, role: string, id: string, input: UpdateWorklogInput) {
        const worklog = await prisma.worklog.findFirst({ where: { id, deletedAt: null } });
        if (!worklog) throw new AppError("Worklog not found", 404);

        if (worklog.userId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only edit your own worklogs", 403);
        }

        const durationMinutes = input.duration !== undefined || input.durationMinutes !== undefined
            ? parseWorklogDuration(input.duration ?? input.durationMinutes)
            : undefined;
        if (durationMinutes === null) {
            throw new AppError("Duration must be a positive Jira-style duration, for example 15m or 1h 30m", 400);
        }

        return await prisma.worklog.update({
            where: { id },
            data: {
                startedAt: input.startedAt,
                durationMinutes,
                description: input.description,
                category: input.category,
                billable: input.billable,
            }
        });
    }

    static async archive(userId: string, role: string, id: string) {
        const worklog = await prisma.worklog.findFirst({ where: { id, deletedAt: null } });
        if (!worklog) throw new AppError("Worklog not found", 404);

        if (worklog.userId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only archive your own worklogs", 403);
        }

        return await prisma.worklog.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    static async restore(userId: string, role: string, id: string) {
        const worklog = await prisma.worklog.findUnique({ where: { id } });
        if (!worklog) throw new AppError("Worklog not found", 404);

        if (worklog.userId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only restore your own worklogs", 403);
        }

        return await prisma.worklog.update({
            where: { id },
            data: { deletedAt: null }
        });
    }

    static async delete(userId: string, role: string, id: string) {
        return this.archive(userId, role, id);
    }

    static async hardDelete(userId: string, role: string, id: string) {
        const worklog = await prisma.worklog.findUnique({ where: { id } });
        if (!worklog) throw new AppError("Worklog not found", 404);

        if (worklog.userId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only delete your own worklogs", 403);
        }

        await prisma.worklog.delete({ where: { id } });
        return { success: true };
    }
}
