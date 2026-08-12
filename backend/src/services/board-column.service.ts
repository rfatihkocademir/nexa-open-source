import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import type { WorkItemStatus } from '@prisma/client';

const ALLOWED_STATUSES: WorkItemStatus[] = [
    'DRAFT', 'BACKLOG', 'TODO', 'OPEN', 'IN_ANALYSIS',
    'IN_PROGRESS', 'FIXED', 'READY_FOR_TEST', 'QA',
    'RETEST', 'DONE', 'CLOSED', 'REOPENED', 'WAITING_FOR_INFO'
];

export class BoardColumnService {
    static async applyTemplate(
        projectId: string,
        userId: string,
        role: string,
        mode: 'REPLACE' | 'APPEND',
        definitions: Array<{
            name: string;
            mappedStatus: string;
            color?: string;
            wipLimit?: number | null;
            allowedTransitionStatuses?: string[];
        }>,
    ) {
        await ProjectAccess.check(projectId, userId, role);

        if (!Array.isArray(definitions) || definitions.length === 0) {
            throw new AppError('Workflow template must contain at least one column', 400);
        }

        const normalized = definitions.map((definition, index) => {
            const name = definition.name?.trim();
            if (!name) throw new AppError(`Column name is required at index ${index}`, 400);
            if (!ALLOWED_STATUSES.includes(definition.mappedStatus as WorkItemStatus)) {
                throw new AppError(`Invalid workflow status: ${definition.mappedStatus}`, 400);
            }
            return {
                name,
                mappedStatus: definition.mappedStatus as WorkItemStatus,
                color: definition.color || null,
                wipLimit: definition.wipLimit ?? null,
                allowedTransitionStatuses: (definition.allowedTransitionStatuses ?? [])
                    .filter((status): status is WorkItemStatus => ALLOWED_STATUSES.includes(status as WorkItemStatus)),
            };
        });

        const duplicateStatuses = normalized
            .map((definition) => definition.mappedStatus)
            .filter((status, index, statuses) => statuses.indexOf(status) !== index);
        if (duplicateStatuses.length > 0) {
            throw new AppError(`Workflow statuses must be unique: ${Array.from(new Set(duplicateStatuses)).join(', ')}`, 400);
        }

        return prisma.$transaction(async (tx) => {
            const existing = await tx.boardColumn.findMany({
                where: { projectId },
                orderBy: { orderIndex: 'asc' },
                select: { id: true, orderIndex: true, mappedStatus: true },
            });
            const startIndex = mode === 'APPEND'
                ? (existing.reduce((max, column) => Math.max(max, column.orderIndex), -1) + 1)
                : existing.length + 100;
            const existingByStatus = new Map(existing.map((column) => [column.mappedStatus, column]));

            const created = [];
            for (const [index, definition] of normalized.entries()) {
                const matchingColumn = mode === 'APPEND' ? existingByStatus.get(definition.mappedStatus) : undefined;
                if (matchingColumn) {
                    created.push(await tx.boardColumn.update({
                        where: { id: matchingColumn.id },
                        data: { name: definition.name, color: definition.color, wipLimit: definition.wipLimit },
                    }));
                    continue;
                }
                created.push(await tx.boardColumn.create({
                    data: {
                        projectId,
                        name: definition.name,
                        mappedStatus: definition.mappedStatus,
                        color: definition.color,
                        wipLimit: definition.wipLimit,
                        orderIndex: startIndex + index,
                        allowedTransitions: [],
                    },
                }));
            }

            const templateColumnsByStatus = new Map(created.map((column) => [column.mappedStatus, column]));
            for (const [index, definition] of normalized.entries()) {
                const allowedTransitions = definition.allowedTransitionStatuses
                    .map((status) => templateColumnsByStatus.get(status)?.id)
                    .filter((id): id is string => Boolean(id));
                created[index] = await tx.boardColumn.update({
                    where: { id: created[index].id },
                    data: { allowedTransitions },
                });
            }

            const columnByStatus = new Map(
                created
                    .filter((column) => column.mappedStatus)
                    .map((column) => [column.mappedStatus as WorkItemStatus, column]),
            );
            for (const [status, column] of columnByStatus) {
                await tx.workItem.updateMany({
                    // Include soft-deleted items as well so REPLACE can remove
                    // old columns without leaving dangling foreign keys.
                    where: { projectId, status },
                    data: { boardColumnId: column.id },
                });
            }

            if (mode === 'REPLACE') {
                const fallbackColumn = created[0];
                const mappedStatuses = [...columnByStatus.keys()];
                await tx.workItem.updateMany({
                    where: {
                        projectId,
                        status: { notIn: mappedStatuses },
                    },
                    data: {
                        boardColumnId: fallbackColumn.id,
                        ...(fallbackColumn.mappedStatus ? { status: fallbackColumn.mappedStatus } : {}),
                    },
                });
                await tx.boardColumn.deleteMany({ where: { id: { in: existing.map((column) => column.id) } } });
                for (const [index, column] of created.entries()) {
                    created[index] = await tx.boardColumn.update({
                        where: { id: column.id },
                        data: { orderIndex: index },
                    });
                }
            }

            return created;
        });
    }

    private static async resolveColumnWithAccess(id: string, userId: string, role: string) {
        const column = await prisma.boardColumn.findUnique({
            where: { id },
            select: { id: true, projectId: true }
        });

        if (!column) {
            throw new AppError('Board column not found', 404);
        }

        await ProjectAccess.check(column.projectId, userId, role);
        return column;
    }

    static async create(
        projectId: string,
        name: string,
        userId: string,
        role: string,
        options?: {
            mappedStatus?: string;
            color?: string;
            wipLimit?: number | null;
            allowedTransitions?: string[];
        }
    ) {
        await ProjectAccess.check(projectId, userId, role);

        const lastColumn = await prisma.boardColumn.findFirst({
            where: { projectId },
            orderBy: { orderIndex: 'desc' },
        });

        const nextOrderIndex = lastColumn ? lastColumn.orderIndex + 1 : 0;

        const mappedStatus = options?.mappedStatus && ALLOWED_STATUSES.includes(options.mappedStatus as WorkItemStatus)
            ? options.mappedStatus as WorkItemStatus
            : undefined;

        if (mappedStatus) {
            const existingMapping = await prisma.boardColumn.findFirst({ where: { projectId, mappedStatus } });
            if (existingMapping) throw new AppError('This workflow status is already mapped to another column', 409);
        }

        return prisma.boardColumn.create({
            data: {
                projectId,
                name,
                orderIndex: nextOrderIndex,
                mappedStatus,
                color: options?.color,
                wipLimit: options?.wipLimit ?? null,
                allowedTransitions: options?.allowedTransitions ?? [],
            },
        });
    }

    static async getByProjectId(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        return prisma.boardColumn.findMany({
            where: { projectId },
            orderBy: { orderIndex: 'asc' },
            include: {
                _count: {
                    select: { workItems: true }
                }
            }
        });
    }

    static async update(
        id: string,
        userId: string,
        role: string,
        fields: {
            name?: string;
            mappedStatus?: string | null;
            color?: string | null;
            wipLimit?: number | null;
            allowedTransitions?: string[];
        }
    ) {
        const column = await this.resolveColumnWithAccess(id, userId, role);

        const mappedStatus = fields.mappedStatus === null
            ? null
            : (fields.mappedStatus && ALLOWED_STATUSES.includes(fields.mappedStatus as WorkItemStatus)
                ? fields.mappedStatus as WorkItemStatus
                : undefined);

        const updateData: Record<string, unknown> = {};
        if (fields.name !== undefined) updateData.name = fields.name;
        if (mappedStatus !== undefined) updateData.mappedStatus = mappedStatus;
        if (fields.color !== undefined) updateData.color = fields.color;
        if (fields.wipLimit !== undefined) updateData.wipLimit = fields.wipLimit;
        if (fields.allowedTransitions !== undefined) updateData.allowedTransitions = fields.allowedTransitions;

        if (mappedStatus) {
            const existingMapping = await prisma.boardColumn.findFirst({
                where: { projectId: column.projectId, mappedStatus, id: { not: id } },
            });
            if (existingMapping) throw new AppError('This workflow status is already mapped to another column', 409);
        }

        return prisma.$transaction(async (tx) => {
            const updated = await tx.boardColumn.update({ where: { id }, data: updateData });
            if (mappedStatus) {
                await tx.workItem.updateMany({
                    where: { boardColumnId: id },
                    data: { status: mappedStatus },
                });
            }
            return updated;
        });
    }

    static async delete(id: string, userId: string, role: string) {
        const column = await prisma.boardColumn.findUnique({
            where: { id },
            select: {
                id: true,
                projectId: true,
                _count: { select: { workItems: true } }
            }
        });

        if (!column) {
            throw new AppError('Board column not found', 404);
        }

        await ProjectAccess.check(column.projectId, userId, role);

        if (column._count.workItems > 0) {
            throw new AppError('Cannot delete column with existing work items. Move them first.', 400);
        }

        return prisma.boardColumn.delete({
            where: { id },
        });
    }

    static async reorder(columns: { id: string; orderIndex: number }[], userId: string, role: string) {
        if (!Array.isArray(columns) || columns.length === 0) {
            return [];
        }

        const ids = Array.from(new Set(columns.map((column) => column.id).filter(Boolean)));
        const existing = await prisma.boardColumn.findMany({
            where: { id: { in: ids } },
            select: { id: true, projectId: true }
        });

        if (existing.length !== ids.length) {
            throw new AppError('One or more board columns were not found', 404);
        }

        const projectIds = new Set(existing.map((column) => column.projectId));
        if (projectIds.size !== 1) {
            throw new AppError('Columns must belong to the same project to reorder', 400);
        }

        const projectId = existing[0]?.projectId;
        if (!projectId) {
            throw new AppError('Project context could not be resolved for board reorder', 400);
        }

        await ProjectAccess.check(projectId, userId, role);

        const updatePromises = columns.map(col =>
            prisma.boardColumn.update({
                where: { id: col.id },
                data: { orderIndex: col.orderIndex },
            })
        );

        return prisma.$transaction(updatePromises);
    }
}
