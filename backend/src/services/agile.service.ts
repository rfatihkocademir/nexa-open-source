import { WorkItemStatus, WorkItemType } from '@prisma/client';
import { extractDocumentationMeta } from '../utils/workItemDocumentation';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { WorkItemPolicyService } from './work-item-policy.service';
import type { WorkflowTransition } from './workflow-scheme.service';

// ─── Default Jira-style columns seeded automatically ─────────────────────────
const DEFAULT_BOARD_COLUMNS: {
    name: string;
    mappedStatus: WorkItemStatus;
    orderIndex: number;
    color: string;
    isDefault: boolean;
    allowedTransitions: string[]; // Filled in after creation by index reference
}[] = [
    { name: 'To Do',       mappedStatus: 'TODO',           orderIndex: 0, color: '#6B7280', isDefault: true, allowedTransitions: [] },
    { name: 'In Progress', mappedStatus: 'IN_PROGRESS',    orderIndex: 1, color: '#3B82F6', isDefault: true, allowedTransitions: [] },
    { name: 'In Review',   mappedStatus: 'READY_FOR_TEST', orderIndex: 2, color: '#F59E0B', isDefault: true, allowedTransitions: [] },
    { name: 'Done',        mappedStatus: 'DONE',           orderIndex: 3, color: '#10B981', isDefault: true, allowedTransitions: [] },
];

export class AgileService {
    /**
     * Ensures every project has at least the default board columns.
     * Called lazily on board load to keep project creation lightweight.
     */
    private async ensureDefaultColumns(projectId: string): Promise<void> {
        const existingCount = await prisma.boardColumn.count({ where: { projectId } });
        if (existingCount > 0) return;

        await prisma.boardColumn.createMany({
            data: DEFAULT_BOARD_COLUMNS.map(col => ({ ...col, projectId })),
            skipDuplicates: true,
        });
    }

    async getBoardData(projectId: string, filters?: {
        sprintId?: string;
        assigneeId?: string;
        priority?: string;
        itemType?: string;
        search?: string;
    }) {
        // Auto-seed columns if the project has none yet
        await this.ensureDefaultColumns(projectId);

        let activeSprint = null;

        if (filters?.sprintId && filters.sprintId !== 'all') {
            activeSprint = await prisma.sprint.findUnique({
                where: { id: filters.sprintId }
            });
        } else {
            activeSprint = await prisma.sprint.findFirst({
                where: { projectId, status: 'ACTIVE' }
            });
        }

        // Fetch all columns for this project
        const boardColumns = await prisma.boardColumn.findMany({
            where: { projectId },
            orderBy: { orderIndex: 'asc' }
        });

        if (!activeSprint) {
            return {
                stories: [],
                bugs: [],
                columns: boardColumns.map(col => ({ ...col, items: [] })),
                unassignedItems: [],
                activeSprint: null
            };
        }

        const where: any = { projectId, sprintId: activeSprint.id, deletedAt: null };

        if (filters?.assigneeId && filters.assigneeId !== 'all') {
            const assigneeIds = filters.assigneeId
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);

            if (assigneeIds.length === 1) {
                where.assigneeId = assigneeIds[0];
            } else if (assigneeIds.length > 1) {
                where.assigneeId = { in: assigneeIds };
            }
        }

        if (filters?.priority && filters.priority !== 'all') {
            const normalizedPriority = filters.priority.toUpperCase();
            const allowedPriorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
            if (allowedPriorities.has(normalizedPriority)) {
                where.priority = normalizedPriority;
            }
        }

        if (filters?.itemType && filters.itemType !== 'all') {
            const normalizedItemType = filters.itemType.toUpperCase();
            const allowedItemTypes = new Set(['STORY', 'BUG', 'TASK', 'EPIC']);
            if (allowedItemTypes.has(normalizedItemType)) {
                where.itemType = normalizedItemType;
            }
        }

        if (filters?.search) {
            where.OR = [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } }
            ];
        }

        const workItems = await prisma.workItem.findMany({
            where,
            include: {
                assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
                parent: { select: { id: true, title: true } },
                children: { where: { deletedAt: null } },
                _count: { select: { testCases: true } }
            },
            orderBy: [
                { boardOrder: 'asc' },
                { updatedAt: 'desc' }
            ]
        });

        const sanitizedWorkItems = workItems.map(item => {
            const docMeta = extractDocumentationMeta(item.description);
            return {
                ...item,
                description: docMeta.description,
                documentationPageId: docMeta.documentationPageId
            };
        });

        // ── Smart placement: if an item has no boardColumnId, auto-assign based on status ──
        const statusToColumnMap = new Map<string, string>();
        for (const col of boardColumns) {
            if (col.mappedStatus) {
                statusToColumnMap.set(col.mappedStatus, col.id);
            }
        }

        // Items with no boardColumnId → place them in the column matching their status
        const itemsNeedingPlacement = sanitizedWorkItems.filter(i => !i.boardColumnId);
        if (itemsNeedingPlacement.length > 0) {
            const updatePromises = itemsNeedingPlacement.map(item => {
                const targetColId = statusToColumnMap.get(item.status) ?? boardColumns[0]?.id;
                if (!targetColId) return Promise.resolve();
                return prisma.workItem.update({
                    where: { id: item.id },
                    data: { boardColumnId: targetColId }
                }).then(() => {
                    item.boardColumnId = targetColId;
                });
            });
            await Promise.all(updatePromises);
        }

        // Group work items by column
        const columnsData = boardColumns.map(col => ({
            id: col.id,
            name: col.name,
            orderIndex: col.orderIndex,
            mappedStatus: col.mappedStatus,
            color: col.color,
            wipLimit: col.wipLimit,
            isDefault: col.isDefault,
            items: sanitizedWorkItems.filter(item => item.boardColumnId === col.id)
        }));

        // Items still without a column (edge case: no column exists yet for their status)
        const unassignedItems = sanitizedWorkItems.filter(item => !item.boardColumnId);

        // Backwards compatibility
        const stories = sanitizedWorkItems.filter(w => w.itemType === WorkItemType.STORY);
        const formattedStories = stories.map(story => {
            const bugs = story.children?.filter(c => c.itemType === WorkItemType.BUG) || [];
            const tasks = story.children?.filter(c => c.itemType === WorkItemType.TASK) || [];
            const epic = story.parent;
            const { parent, children, ...rest } = story;
            return { ...rest, epic, bugs, tasks };
        });

        const standaloneBugs = sanitizedWorkItems.filter(w => w.itemType === WorkItemType.BUG && !w.parentId);

        return {
            columns: columnsData,
            unassignedItems,
            stories: formattedStories,
            bugs: standaloneBugs,
            activeSprint: {
                id: activeSprint.id,
                name: activeSprint.name,
                goal: activeSprint.goal,
                startDate: activeSprint.startDate,
                endDate: activeSprint.endDate,
                status: activeSprint.status
            }
        };
    }

    /**
     * Moves a work item to a new board column.
     * When a column has a mappedStatus, the item's status is automatically updated too.
     * This keeps the WorkItemStatus in sync with the board position (Jira behaviour).
     */
    async moveItem(_type: string, id: string, targetColumnId: string, orderIndex?: number, actor?: { userId: string; role: string }) {
        const updateData: any = {};
        const transitionComments: string[] = [];

        // UUID check — is it a column ID or a raw status string?
        const isColumnId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetColumnId);

        if (isColumnId) {
            const [item, column] = await Promise.all([
                prisma.workItem.findFirst({
                    // Board clients normally send the UUID, but accepting the
                    // public work-item key keeps this endpoint consistent with
                    // the route's project resolver and avoids stale-card 404s.
                    where: { OR: [{ id }, { key: id.toUpperCase() }] },
                    select: {
                        id: true, projectId: true, boardColumnId: true, status: true, itemType: true,
                        priority: true, assigneeId: true, reporterId: true, customFields: true,
                        title: true, description: true, acceptanceCriteria: true, stepsToReproduce: true,
                        worklogs: { where: { deletedAt: null }, select: { durationMinutes: true } },
                    },
                }),
                prisma.boardColumn.findUnique({
                    where: { id: targetColumnId },
                    select: { id: true, projectId: true, mappedStatus: true, wipLimit: true },
                }),
            ]);
            if (!item) throw new AppError('Work item not found', 404);
            if (!column || column.projectId !== item.projectId) throw new AppError('Target workflow column does not belong to this project', 400);

            if (item.boardColumnId && item.boardColumnId !== targetColumnId) {
                const source = await prisma.boardColumn.findUnique({
                    where: { id: item.boardColumnId },
                    select: { allowedTransitions: true },
                });
                if (source && source.allowedTransitions.length > 0 && !source.allowedTransitions.includes(targetColumnId)) {
                    throw new AppError('Bu iş akışı geçişine izin verilmiyor.', 409);
                }
            }

            if (item.boardColumnId !== targetColumnId && column.wipLimit) {
                const occupied = await prisma.workItem.count({
                    where: { boardColumnId: targetColumnId, deletedAt: null },
                });
                if (occupied >= column.wipLimit) {
                    throw new AppError(`WIP limiti aşılamaz: bu kolonda en fazla ${column.wipLimit} iş olabilir.`, 409);
                }
            }

            if (item.boardColumnId && item.boardColumnId !== targetColumnId) {
                const scheme = await prisma.workflowScheme.findUnique({
                    where: { projectId: item.projectId },
                    select: { publishedConfig: true },
                });
                const published = scheme?.publishedConfig && typeof scheme.publishedConfig === 'object'
                    ? scheme.publishedConfig as Record<string, unknown>
                    : undefined;
                const transitions = Array.isArray(published?.transitions) ? published.transitions as WorkflowTransition[] : [];
                const pathRules = transitions.filter((transition) => transition.fromColumnId === item.boardColumnId && transition.toColumnId === targetColumnId);
                const rule = pathRules.find((transition) => transition.itemTypes.length === 0 || transition.itemTypes.includes(item.itemType));
                if (pathRules.length > 0 && !rule) throw new AppError('Bu iş tipi için workflow geçişi tanımlı değil.', 409);
                if (rule) {
                    for (const condition of rule.conditions) {
                        if (condition.type === 'ROLE_ALLOWED' && (!actor || !condition.values.includes(actor.role))) throw new AppError(`"${rule.name}" geçişi rolünüz için kullanılamaz.`, 403);
                        if (condition.type === 'ASSIGNEE_REQUIRED' && !item.assigneeId) throw new AppError(`"${rule.name}" geçişi için işin bir sorumlusu olmalıdır.`, 409);
                        if (condition.type === 'PRIORITY_ALLOWED' && !condition.values.includes(item.priority)) throw new AppError(`"${rule.name}" geçişi ${item.priority} önceliği için kullanılamaz.`, 409);
                    }
                    for (const validator of rule.validators) {
                        if (validator.type === 'REQUIRED_FIELDS') {
                            const customFields = item.customFields && typeof item.customFields === 'object' ? item.customFields as Record<string, unknown> : {};
                            const itemFields = item as unknown as Record<string, unknown>;
                            const missing = (validator.fields ?? []).filter((field) => {
                                const value = field in itemFields ? itemFields[field] : customFields[field];
                                return value === null || value === undefined || value === '';
                            });
                            if (missing.length) throw new AppError(`"${rule.name}" geçişi için zorunlu alanlar eksik: ${missing.join(', ')}`, 409);
                        }
                        if (validator.type === 'MIN_WORKLOG') {
                            const minutes = item.worklogs.reduce((total, worklog) => total + worklog.durationMinutes, 0);
                            if (minutes < (validator.minimumMinutes ?? 0)) throw new AppError(`"${rule.name}" geçişi için en az ${validator.minimumMinutes} dakika worklog gerekir.`, 409);
                        }
                        if (validator.type === 'TEST_CASE_REQUIRED') {
                            const testCount = await prisma.testCase.count({ where: { workItemId: item.id, deletedAt: null } });
                            if (testCount === 0) throw new AppError(`"${rule.name}" geçişi için en az bir test case bağlanmalıdır.`, 409);
                        }
                    }
                    for (const action of rule.postActions) {
                        if (action.type === 'SET_PRIORITY') updateData.priority = action.value;
                        if (action.type === 'ASSIGN_REPORTER' && item.reporterId) updateData.assigneeId = item.reporterId;
                        if (action.type === 'ADD_COMMENT' && action.value) transitionComments.push(action.value);
                    }
                }
            }

            // Sync item status with column's workflow status
            if (column?.mappedStatus) {
                await WorkItemPolicyService.assertCompletion(item.id, column.mappedStatus);
                updateData.status = column.mappedStatus;
            }
            updateData.boardColumnId = targetColumnId;
        } else {
            // Legacy: raw status string was passed
            const item = await prisma.workItem.findFirst({
                where: { OR: [{ id }, { key: id.toUpperCase() }] },
                select: { id: true },
            });
            if (!item) throw new AppError('Work item not found', 404);
            await WorkItemPolicyService.assertCompletion(item.id, targetColumnId);
            updateData.status = targetColumnId;
        }

        if (orderIndex !== undefined) {
            updateData.boardOrder = orderIndex;
        }

        if (transitionComments.length && !actor?.userId) throw new AppError('Workflow comment action requires an authenticated actor', 401);
        const item = await prisma.workItem.findFirst({
            where: { OR: [{ id }, { key: id.toUpperCase() }] },
            select: { id: true },
        });
        if (!item) throw new AppError('Work item not found', 404);
        return prisma.$transaction(async (tx) => {
            const updated = await tx.workItem.update({
                where: { id: item.id },
                data: updateData,
                include: {
                    assignee: { select: { id: true, firstName: true, lastName: true, email: true } }
                }
            });
            if (transitionComments.length) {
                await tx.comment.createMany({
                    data: transitionComments.map((content) => ({ content, workItemId: item.id, authorId: actor!.userId })),
                });
            }
            return updated;
        });
    }

    /**
     * Returns sprint statistics for the completion dialog.
     * Shows breakdown of complete vs incomplete items.
     */
    async getSprintCompletionStats(sprintId: string) {
        const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint) throw new AppError('Sprint not found', 404);

        const allItems = await prisma.workItem.findMany({
            where: { sprintId, deletedAt: null },
            select: { id: true, title: true, status: true, itemType: true, storyPoints: true }
        });

        const doneItems = allItems.filter(i => i.status === 'DONE' || i.status === 'CLOSED');
        const incompleteItems = allItems.filter(i => i.status !== 'DONE' && i.status !== 'CLOSED');

        // Find next sprint options
        const nextSprints = await prisma.sprint.findMany({
            where: { projectId: sprint.projectId, status: 'PLANNED' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true }
        });

        return {
            sprint,
            totalItems: allItems.length,
            doneItems: doneItems.length,
            incompleteItems: incompleteItems.length,
            incompleteItemsList: incompleteItems,
            completionRate: allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 100,
            nextSprints
        };
    }

    /**
     * Completes a sprint with proper handling of incomplete items (Jira-style).
     */
    async completeSprint(
        sprintId: string,
        incompleteItemsAction: 'MOVE_TO_BACKLOG' | 'MOVE_TO_NEXT_SPRINT',
        nextSprintId?: string
    ) {
        const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint) throw new AppError('Sprint not found', 404);

        const incompleteItems = await prisma.workItem.findMany({
            where: {
                sprintId,
                deletedAt: null,
                status: { notIn: ['DONE', 'CLOSED'] }
            },
            select: { id: true }
        });

        const incompleteIds = incompleteItems.map(i => i.id);

        await prisma.$transaction(async (tx) => {
            // Handle incomplete items
            if (incompleteIds.length > 0) {
                if (incompleteItemsAction === 'MOVE_TO_BACKLOG') {
                    await tx.workItem.updateMany({
                        where: { id: { in: incompleteIds } },
                        data: { sprintId: null, boardColumnId: null, status: 'BACKLOG' }
                    });
                } else if (incompleteItemsAction === 'MOVE_TO_NEXT_SPRINT' && nextSprintId) {
                    await tx.workItem.updateMany({
                        where: { id: { in: incompleteIds } },
                        data: { sprintId: nextSprintId, boardColumnId: null }
                    });
                }
            }

            // Mark sprint as closed
            await tx.sprint.update({
                where: { id: sprintId },
                data: {
                    status: 'CLOSED',
                    endDate: sprint.endDate ?? new Date()
                }
            });
        });

        return { success: true, movedItems: incompleteIds.length };
    }
}
