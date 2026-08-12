import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { CreateMilestoneInput, UpdateMilestoneInput } from '../validations/milestone.validation';
import { ProjectAccess } from '../utils/projectAccess';

const ALLOWED_SORT_FIELDS = ['name', 'dueDate', 'status'] as const;
type MilestoneSortField = typeof ALLOWED_SORT_FIELDS[number];

export class MilestoneService {
    async create(data: CreateMilestoneInput, userId: string, role: string) {
        // Check if project exists
        const project = await prisma.project.findUnique({
            where: { id: data.projectId },
        });

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        // Check project access
        await ProjectAccess.check(data.projectId, userId, role);

        // Check if milestone name exists in the project
        const existingMilestone = await prisma.milestone.findFirst({
            where: {
                name: data.name,
                projectId: data.projectId,
            },
        });

        if (existingMilestone) {
            throw new AppError('Milestone with this name already exists in the project', 400);
        }

        return prisma.$transaction(async (tx) => {
            const keyedProject = await (tx.project as any).update({
                where: { id: data.projectId },
                data: { nextMilestoneNumber: { increment: 1 } },
                select: { key: true, nextMilestoneNumber: true },
            });
            const sequenceNumber = keyedProject.nextMilestoneNumber - 1;

            return (tx.milestone as any).create({
                data: {
                    ...data,
                    key: `${keyedProject.key}-MS-${sequenceNumber}`,
                    sequenceNumber,
                    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                },
            });
        });
    }

    async getAll(
        userId: string,
        role: string,
        projectId?: string,
        page: number = 1,
        limit: number = 10,
        sortBy: string = 'dueDate',
        sortOrder: 'asc' | 'desc' = 'asc',
        includeArchived: boolean = false
    ) {
        if (!projectId) throw new AppError('projectId is required for listing milestones', 400);
        await ProjectAccess.check(projectId, userId, role);
        const where: any = { projectId };
        if (!includeArchived) {
            // @ts-ignore - Prisma types update lag
            where.deletedAt = null;
        }

        const resolvedSortBy: MilestoneSortField = ALLOWED_SORT_FIELDS.includes(sortBy as MilestoneSortField)
            ? (sortBy as MilestoneSortField)
            : 'dueDate';

        const skip = (page - 1) * limit;

        const [total, milestones] = await Promise.all([
            prisma.milestone.count({ where }),
            prisma.milestone.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [resolvedSortBy]: sortOrder },
                include: {
                    project: { select: { name: true } },
                    _count: {
                        // @ts-ignore - Prisma types update lag
                        select: { testRuns: { where: { deletedAt: null } } },
                    },
                },
            })
        ]);

        return {
            data: milestones,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getById(id: string, userId: string, role: string, includeArchived: boolean = false) {
        const where: any = { id };
        if (!includeArchived) {
            // @ts-ignore - Prisma types update lag
            where.deletedAt = null;
        }

        const milestone = await prisma.milestone.findFirst({
            where,
            include: {
                project: { select: { name: true } },
                testRuns: {
                    // @ts-ignore - Prisma types update lag
                    where: { deletedAt: null },
                    include: {
                        items: {
                            select: {
                                finalStatus: true,
                            },
                        },
                        _count: {
                            select: { items: true }
                        }
                    },
                },
            },
        });

        if (!milestone) {
            throw new AppError('Milestone not found', 404);
        }

        await ProjectAccess.check(milestone.projectId, userId, role);

        return milestone;
    }

    async update(id: string, data: UpdateMilestoneInput, userId: string, role: string) {
        const milestone = await this.getById(id, userId, role);

        if (data.name) {
            const existingMilestone = await prisma.milestone.findFirst({
                where: {
                    name: data.name,
                    projectId: milestone.projectId,
                    // @ts-ignore - Prisma types update lag
                    deletedAt: null,
                    NOT: { id },
                },
            });

            if (existingMilestone) {
                throw new AppError('Milestone with this name already exists in the project', 400);
            }
        }

        return prisma.milestone.update({
            where: { id },
            data: {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            },
        });
    }

    async archive(id: string, userId: string, role: string) {
        await this.getById(id, userId, role);
        return prisma.milestone.update({
            where: { id },
            // @ts-ignore - Prisma types update lag
            data: { deletedAt: new Date() },
        });
    }

    async restore(id: string, userId: string, role: string) {
        const milestone = await prisma.milestone.findUnique({ where: { id } });
        if (!milestone) {
            throw new AppError('Milestone not found', 404);
        }
        await ProjectAccess.check(milestone.projectId, userId, role);

        return prisma.milestone.update({
            where: { id },
            // @ts-ignore - Prisma types update lag
            data: { deletedAt: null },
        });
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    async hardDelete(id: string, userId: string, role: string) {
        await this.getById(id, userId, role);
        return prisma.milestone.delete({
            where: { id },
        });
    }
}

export const milestoneService = new MilestoneService();
