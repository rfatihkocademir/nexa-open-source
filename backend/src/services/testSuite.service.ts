import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { CreateSuiteInput, UpdateSuiteInput } from '../validations/testSuite.validation';
import { ProjectAccess } from '../utils/projectAccess';

export class TestSuiteService {
    async create(data: CreateSuiteInput, userId: string, role: string) {
        // Check project exists
        const project = await prisma.project.findUnique({
            where: { id: data.projectId },
        });

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        // Check project access
        await ProjectAccess.check(data.projectId, userId, role);

        // Check parent suite if provided
        if (data.parentId) {
            const parent = await prisma.testSuite.findUnique({
                where: { id: data.parentId },
            });

            if (!parent) {
                throw new AppError('Parent suite not found', 404);
            }

            if (parent.projectId !== data.projectId) {
                throw new AppError('Parent suite must belong to the same project', 400);
            }
        }

        return prisma.testSuite.create({
            data,
        });
    }

    async getAll(userId: string, role: string, projectId: string, page: number = 1, limit: number = 50, includeDeleted: boolean = false) {
        await ProjectAccess.check(projectId, userId, role);

        const skip = (page - 1) * limit;

        const where: any = { projectId };

        // Only admins can see deleted items, and only if requested
        if (role === 'ADMIN' && includeDeleted) {
            // No filter on deletedAt
        } else {
            where.deletedAt = null;
        }

        const [items, total] = await Promise.all([
            prisma.testSuite.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            testCases: { where: { deletedAt: null } },
                            children: { where: { deletedAt: null } }
                        },
                    },
                },
            }),
            prisma.testSuite.count({ where }),
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getById(id: string, userId: string, role: string) {
        const suite = await prisma.testSuite.findUnique({
            where: { id },
            include: {
                children: {
                    where: { deletedAt: null }
                },
                testCases: {
                    where: { deletedAt: null }
                },
                parent: true,
            },
        });

        if (!suite) {
            throw new AppError('Test suite not found', 404);
        }

        // If suite is deleted and user is NOT admin and NOT requesting specific access (usually filtering happens in list)
        // But getById specifically might need to show it if Admin.
        if (suite.deletedAt && role !== 'ADMIN') {
            throw new AppError('Test suite not found', 404);
        }

        await ProjectAccess.check(suite.projectId, userId, role);

        return suite;
    }

    async update(id: string, data: UpdateSuiteInput, userId: string, role: string) {
        const suite = await this.getById(id, userId, role);

        if (data.parentId) {
            // Prevent circular dependency
            if (data.parentId === id) {
                throw new AppError('Cannot set suite as its own parent', 400);
            }

            const parent = await prisma.testSuite.findUnique({
                where: { id: data.parentId },
            });

            if (!parent) {
                throw new AppError('Parent suite not found', 404);
            }

            if (parent.projectId !== suite.projectId) {
                throw new AppError('Parent suite must belong to the same project', 400);
            }
        }

        return prisma.testSuite.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, userId: string, role: string) {
        await this.getById(id, userId, role);

        const deleteRecursively = async (suiteId: string) => {
            const suite = await prisma.testSuite.findUnique({
                where: { id: suiteId },
                include: { children: true }
            });

            if (!suite) return;

            const deletedAt = new Date();
            // Soft delete current suite
            await prisma.testSuite.update({
                where: { id: suiteId },
                data: { deletedAt }
            });

            // Soft delete test cases
            await prisma.testCase.updateMany({
                where: { suiteId: suiteId, deletedAt: null },
                data: { deletedAt }
            });

            // Recurse for children
            for (const child of suite.children) {
                await deleteRecursively(child.id);
            }
        };

        await deleteRecursively(id);

        return { success: true, message: 'Test suite and its contents soft deleted.' };
    }

    async restore(id: string, userId: string, role: string) {
        if (role !== 'ADMIN') {
            throw new AppError('Only admins can restore deleted items', 403);
        }

        const suite = await prisma.testSuite.findUnique({
            where: { id },
            include: { children: true } // Need to find children even if deleted
        });

        if (!suite) {
            throw new AppError('Test suite not found', 404);
        }

        await ProjectAccess.check(suite.projectId, userId, role);

        const restoreRecursively = async (suiteId: string) => {
            // We need to fetch children that MIGHT be deleted. 
            // findUnique by default returns deleted items (since prisma doesn't hide them automatically unless we use middleware or explicit where)
            // But my recursive function needs to traverse.

            const currentSuite = await prisma.testSuite.findUnique({
                where: { id: suiteId },
                include: { children: true }
            });

            if (!currentSuite) return;

            // Restore suite
            await prisma.testSuite.update({
                where: { id: suiteId },
                data: { deletedAt: null }
            });

            // Restore test cases using current timestamp check logic? 
            // Or just restore all cases in this suite?
            // Since we deleted ALL cases in the suite when deleting, we can restore ALL.
            // Issue: if a case was deleted BEFORE the suite was deleted, it will be restored too.
            // For now, this is acceptable behavior for "Restore Suite".
            await prisma.testCase.updateMany({
                where: { suiteId: suiteId, deletedAt: { gte: currentSuite.deletedAt || new Date(0) } },
                data: { deletedAt: null }
            });

            for (const child of currentSuite.children) {
                // Determine if we should restore child? 
                // Getting `children` from `include` will return all children.
                // If we want to restore the tree, yes.
                await restoreRecursively(child.id);
            }
        }

        await restoreRecursively(id);

        return { success: true, message: 'Test suite restored successfully.' };
    }
}

export const testSuiteService = new TestSuiteService();
