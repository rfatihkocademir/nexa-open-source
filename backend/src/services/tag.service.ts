import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';

interface CreateTagInput {
    name: string;
    color?: string;
    projectId: string;
}

interface UpdateTagInput {
    name?: string;
    color?: string;
}

export const tagService = {
    async create(data: CreateTagInput, userId: string, role: string) {
        await ProjectAccess.check(data.projectId, userId, role);

        return prisma.tag.create({
            data: {
                name: data.name,
                color: data.color || '#6B7280',
                projectId: data.projectId,
            },
        });
    },

    async update(id: string, data: UpdateTagInput, userId: string, role: string) {
        await ProjectAccess.checkByTag(id, userId, role);

        return prisma.tag.update({
            where: { id, deletedAt: null },
            data,
        });
    },

    async archive(id: string, userId: string, role: string) {
        await ProjectAccess.checkByTag(id, userId, role);

        return prisma.tag.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    },

    async restore(id: string, userId: string, role: string) {
        await ProjectAccess.checkByTag(id, userId, role);

        return prisma.tag.update({
            where: { id },
            data: { deletedAt: null },
        });
    },

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    },

    async hardDelete(id: string, userId: string, role: string) {
        await ProjectAccess.checkByTag(id, userId, role);

        return prisma.tag.delete({
            where: { id },
        });
    },

    async getById(id: string, userId: string, role: string) {
        await ProjectAccess.checkByTag(id, userId, role);

        return prisma.tag.findFirst({
            where: { id, deletedAt: null },
        });
    },

    async getByProject(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        return prisma.tag.findMany({
            where: { projectId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    },
};
