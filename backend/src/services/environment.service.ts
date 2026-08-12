import { EnvironmentType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

export class EnvironmentService {
    async findAll(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        return prisma.environment.findMany({
            where: { projectId },
            orderBy: { orderIndex: 'asc' }
        });
    }

    async findById(id: string) {
        return prisma.environment.findUnique({
            where: { id }
        });
    }

    async create(projectId: string, data: {
        name: string;
        description?: string;
        type?: EnvironmentType;
        orderIndex?: number;
        isProduction?: boolean;
        requiresApproval?: boolean;
        deploymentPolicy?: string;
        rollbackPolicy?: string;
    }, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const existing = await prisma.environment.findFirst({
            where: { projectId, name: data.name }
        });

        if (existing) {
            throw new AppError(`Environment with name "${data.name}" already exists in this project`, 409);
        }

        return prisma.environment.create({
            data: {
                ...data,
                projectId
            }
        });
    }

    async update(id: string, data: Partial<{
        name: string;
        description: string | null;
        type: EnvironmentType;
        orderIndex: number;
        isProduction: boolean;
        requiresApproval: boolean;
        deploymentPolicy: string | null;
        rollbackPolicy: string | null;
    }>, userId: string, role: string) {
        await ProjectAccess.checkByEnvironment(id, userId, role);

        return prisma.environment.update({
            where: { id },
            data
        });
    }

    async archive(id: string, userId: string, role: string) {
        await ProjectAccess.checkByEnvironment(id, userId, role);

        return prisma.environment.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    async hardDelete(id: string, userId: string, role: string) {
        await ProjectAccess.checkByEnvironment(id, userId, role);

        return prisma.environment.delete({
            where: { id }
        });
    }

    async ensureDefaults(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const count = await prisma.environment.count({ where: { projectId } });
        if (count > 0) return;

        const defaults = [
            { name: 'Development', type: EnvironmentType.DEV, orderIndex: 0 },
            { name: 'QA', type: EnvironmentType.QA, orderIndex: 1 },
            { name: 'Pre-Production', type: EnvironmentType.PREPROD, orderIndex: 2 },
            { name: 'Production', type: EnvironmentType.PROD, orderIndex: 3, isProduction: true, requiresApproval: true }
        ];

        for (const env of defaults) {
            await prisma.environment.create({
                data: {
                    ...env,
                    projectId
                }
            });
        }
    }

    async findOrCreateByName(projectId: string, name: string, type: EnvironmentType = EnvironmentType.QA) {
        let env = await prisma.environment.findFirst({
            where: { projectId, name }
        });

        if (!env) {
            env = await prisma.environment.create({
                data: {
                    projectId,
                    name,
                    type
                }
            });
        }

        return env;
    }
}

export const environmentService = new EnvironmentService();
