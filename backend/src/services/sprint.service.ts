import prisma from "../utils/prisma";
import { CreateSprintInput, UpdateSprintInput, SprintFilters } from "../types/sprint";
import { ProjectAccess } from "../utils/projectAccess";
import { AppError } from "../utils/AppError";
import { SprintStatus } from "@prisma/client";

export class SprintService {
    static async create(userId: string, role: string, input: CreateSprintInput) {
        await ProjectAccess.check(input.projectId, userId, role);
        if (input.capacityPoints != null && (!Number.isInteger(input.capacityPoints) || input.capacityPoints <= 0)) {
            throw new AppError("Sprint capacity must be a positive integer", 400);
        }

        return await prisma.sprint.create({
            data: input
        });
    }

    static async getAll(userId: string, role: string, projectId: string, filters?: SprintFilters) {
        await ProjectAccess.check(projectId, userId, role);

        const where: any = { projectId };

        if (filters?.status) where.status = filters.status;

        return await prisma.sprint.findMany({
            where,
            include: {
                _count: {
                    select: { workItems: true }
                }
            },
            orderBy: { startDate: 'desc' }
        });
    }

    static async getById(userId: string, role: string, id: string) {
        const sprint = await prisma.sprint.findUnique({
            where: { id },
            include: {
                workItems: {
                    include: {
                        assignee: { select: { id: true, firstName: true, lastName: true } }
                    }
                }
            }
        });

        if (!sprint) throw new AppError("Sprint not found", 404);
        await ProjectAccess.check(sprint.projectId, userId, role);

        return sprint;
    }

    static async update(userId: string, role: string, id: string, input: UpdateSprintInput) {
        const sprint = await prisma.sprint.findUnique({ where: { id } });
        if (!sprint) throw new AppError("Sprint not found", 404);

        await ProjectAccess.check(sprint.projectId, userId, role);
        if (input.capacityPoints != null && (!Number.isInteger(input.capacityPoints) || input.capacityPoints <= 0)) {
            throw new AppError("Sprint capacity must be a positive integer", 400);
        }

        return await prisma.sprint.update({
            where: { id },
            data: input
        });
    }

    static async delete(userId: string, role: string, id: string) {
        const sprint = await prisma.sprint.findUnique({ where: { id } });
        if (!sprint) throw new AppError("Sprint not found", 404);

        await ProjectAccess.check(sprint.projectId, userId, role);

        await prisma.sprint.delete({ where: { id } });
        return { success: true };
    }

    static async start(userId: string, role: string, id: string) {
        const sprint = await prisma.sprint.findUnique({ where: { id } });
        if (!sprint) throw new AppError("Sprint not found", 404);

        await ProjectAccess.check(sprint.projectId, userId, role);

        if (sprint.status === SprintStatus.CLOSED) {
            throw new AppError("Cannot start a closed sprint", 400);
        }

        return await prisma.sprint.update({
            where: { id },
            data: {
                status: SprintStatus.ACTIVE,
                startDate: sprint.startDate ?? new Date(),
            },
        });
    }

    static async complete(userId: string, role: string, id: string) {
        const sprint = await prisma.sprint.findUnique({ where: { id }, include: { workItems: { where: { deletedAt: null }, select: { id: true, status: true, storyPoints: true, sprintAddedAt: true } }, planningSessions: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, take: 1 } } });
        if (!sprint) throw new AppError("Sprint not found", 404);

        await ProjectAccess.check(sprint.projectId, userId, role);

        if (sprint.planningSessions.length) throw new AppError('Sprint planlama oturumu tamamlanmadan sprint kapatılamaz.', 409);
        const endDate = sprint.endDate ?? new Date();
        const done = sprint.workItems.filter((item) => item.status === 'DONE' || item.status === 'CLOSED');
        const completedPoints = done.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
        const totalPoints = sprint.workItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
        const unplannedPoints = sprint.workItems.filter((item) => item.sprintAddedAt && sprint.startDate && item.sprintAddedAt > sprint.startDate).reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
        const completedMinutes = await prisma.worklog.aggregate({ where: { workItemId: { in: sprint.workItems.map((item) => item.id) }, deletedAt: null }, _sum: { durationMinutes: true } });
        return prisma.$transaction(async (tx) => {
            const updated = await tx.sprint.update({ where: { id }, data: { status: SprintStatus.CLOSED, endDate } });
            await tx.sprintPlanningOutcome.upsert({ where: { sprintId: id }, create: { sprintId: id, plannedPoints: totalPoints, plannedMinutes: 0, completedPoints, completedMinutes: completedMinutes._sum.durationMinutes ?? 0, spilloverPoints: totalPoints - completedPoints, unplannedPoints }, update: { completedPoints, completedMinutes: completedMinutes._sum.durationMinutes ?? 0, spilloverPoints: totalPoints - completedPoints, unplannedPoints, calculatedAt: new Date() } });
            return updated;
        });
    }
}
