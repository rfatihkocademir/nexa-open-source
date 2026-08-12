import { knowledgeService } from './knowledge.service';
import { workflowGateService } from './workflowGate.service';
import { environmentService } from './environment.service';
import { assertWorkItemTransition } from '../utils/stateMachine';
import { artifactService } from './artifact.service';
import { impactAnalysisService } from './impactAnalysis.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/AppError';
import { buildDescriptionWithDocumentation, extractDocumentationMeta } from '../utils/workItemDocumentation';
import { getAIJob, getAIJobs } from './aiJobStorage.service';
import { WorkItemStatus, WorkItemType } from '@prisma/client';
import prisma from '../utils/prisma';
import { WorkItemPolicyService } from './work-item-policy.service';
import { workConfigurationService } from './work-configuration.service';
import { nqlService } from './nql.service';
import { workAutomationService } from './work-automation.service';
import { runInBackground } from '../utils/backgroundTask';
import { createLogger } from '../utils/logger';
import { dataGovernanceService } from './data-governance.service';

const automationLogger = createLogger('WorkItemAutomation');

export class WorkItemService {
    async search(projectId: string, query: string, actorId: string, page = 1, pageSize = 50) {
        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.max(1, Math.min(500, Math.floor(pageSize)));
        const compiled = nqlService.compile(query, actorId);
        const where = { projectId, deletedAt: null, ...compiled.where };
        const [items, total] = await prisma.$transaction([
            prisma.workItem.findMany({
                where,
                orderBy: compiled.orderBy,
                skip: (safePage - 1) * safePageSize,
                take: safePageSize,
                include: {
                    assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
                    reporter: { select: { id: true, firstName: true, lastName: true } },
                    workType: { select: { id: true, key: true, name: true, color: true, icon: true } },
                    _count: { select: { testCases: true, children: true, comments: true } },
                },
            }),
            prisma.workItem.count({ where }),
        ]);
        return { items: items.map((item) => this.sanitizeWorkItem(item)), total, page: safePage, pageSize: safePageSize, query };
    }

    async create(data: Record<string, unknown>, actorId?: string) {
        const normalized = this.normalizePayload(data);
        const itemType = this.parseWorkItemType(normalized.itemType);
        const projectId = this.requireNonEmptyString(normalized.projectId, 'projectId');
        
        // Requirements are mandatory for planned development work, but a bug
        // may be discovered before it can be mapped to a requirement.
        const requiresRequirement = itemType === WorkItemType.EPIC
            || itemType === WorkItemType.STORY
            || itemType === WorkItemType.TASK;
        const requirementId = requiresRequirement
            ? this.requireNonEmptyString(normalized.requirementId, 'requirementId')
            : this.optionalNonEmptyString(normalized.requirementId);
        if (requirementId) await this.assertRequirementBelongsToProject(requirementId, projectId);
        const documentationField = this.parseDocumentationPageField(normalized);

        delete normalized.documentationPageId;

        if (itemType === WorkItemType.EPIC && !documentationField.value) {
            throw new AppError('documentationPageId is required for epic creation', 400);
        }

        if (documentationField.value) {
            await this.assertDocumentationPageBelongsToProject(documentationField.value, projectId);
        }

        const parentId = this.normalizeNullableString(normalized.parentId, 'parentId');
        if (itemType === WorkItemType.STORY && parentId) {
            await this.assertParentEpicHasDocumentation(parentId, projectId);
        }
        normalized.parentId = parentId;

        if (!this.optionalNonEmptyString(normalized.boardColumnId) && projectId) {
            const firstCol = await prisma.boardColumn.findFirst({
                where: { projectId },
                orderBy: { orderIndex: 'asc' },
                select: { id: true, mappedStatus: true },
            });
            if (firstCol) {
                normalized.boardColumnId = firstCol.id;
                if (!normalized.status && firstCol.mappedStatus) {
                    normalized.status = firstCol.mappedStatus;
                }
            }
        }

        normalized.itemType = itemType;
        normalized.projectId = projectId;
        normalized.customFields = await workConfigurationService.validateWorkItemFields(
            projectId,
            itemType,
            normalized.workTypeId,
            normalized.customFields,
        );

        if (['BUG', 'DEFECT', 'INCIDENT'].includes(itemType)) {
            if (!normalized.severity) {
                throw new AppError(`Severity is required for ${itemType}`, 400);
            }
            if (!normalized.stepsToReproduce && itemType === 'BUG') {
                throw new AppError('Steps to reproduce are required for BUG type', 400);
            }
        }

        normalized.description = buildDescriptionWithDocumentation(
            this.normalizeOptionalText(normalized.description, 'description'),
            itemType === WorkItemType.EPIC ? documentationField.value : null
        );

        if (!(normalized as any).foundInEnvId && (normalized as any).foundInEnv && projectId) {
            const env = await environmentService.findOrCreateByName(projectId, String((normalized as any).foundInEnv));
            (normalized as any).foundInEnvId = env.id;
        }
        delete (normalized as any).foundInEnv;

        // Tier 4: AI Write Lockdown
        // If no actorId provided (meaning it's likely an automated/AI path), force status to DRAFT
        if (!actorId) {
            normalized.status = 'DRAFT' as any;
        }

        const created = await prisma.$transaction(async (tx) => {
            const project = await tx.project.update({
                where: { id: projectId },
                data: { nextWorkItemNumber: { increment: 1 } },
                select: { key: true, nextWorkItemNumber: true },
            });
            const maxSequence = await tx.workItem.aggregate({
                where: { projectId },
                _max: { sequenceNumber: true },
            });
            const sequenceNumber = Math.max(
                project.nextWorkItemNumber - 1,
                (maxSequence._max.sequenceNumber ?? 0) + 1
            );

            // Imports and legacy seeds may create keyed records without advancing
            // the project counter. Repair it inside the same serialized transaction.
            if (sequenceNumber >= project.nextWorkItemNumber) {
                await tx.project.update({
                    where: { id: projectId },
                    data: { nextWorkItemNumber: sequenceNumber + 1 },
                });
            }

            return tx.workItem.create({
                data: {
                    ...normalized as any,
                    documentationPageId: itemType === WorkItemType.EPIC ? documentationField.value : null,
                    key: `${project.key}-${sequenceNumber}`,
                    sequenceNumber,
                }
            });
        });
        
        if (actorId) {
            await artifactService.createRevision({
                entityType: 'WorkItem',
                entityId: created.id,
                body: created,
                authorId: actorId,
                status: 'PUBLISHED'
            });

            await auditService.logCreate(
                { actorId, projectId },
                'WorkItem',
                created.id,
                created
            );
        }

        // Index for Project Memory
        knowledgeService.indexEntity(created.projectId, 'WorkItem', created.id, `${created.title}\n${created.description || ''}`);
        if (actorId) runInBackground(
            () => workAutomationService.dispatch('WORK_ITEM_CREATED', created.projectId, created.id, actorId),
            (error) => automationLogger.error('WORK_ITEM_CREATED dispatch failed', error),
        );

        return this.sanitizeWorkItem(created);
    }

    async findAll(projectId: string, itemType?: WorkItemType, includeArchived: boolean = false) {
        const where: any = { projectId };
        if (itemType) {
            where.itemType = itemType;
        }
        if (!includeArchived) {
            where.deletedAt = null;
        }
        const items = await prisma.workItem.findMany({
            where,
            include: {
                assignee: { select: { id: true, firstName: true, lastName: true } },
                reporter: { select: { id: true, firstName: true, lastName: true } },
                parent: { select: { id: true, title: true, itemType: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const aiJobs = await getAIJobs('WorkItem', items.map((item) => item.id));
        return items.map(item => this.sanitizeWorkItem({ ...item, aiJob: aiJobs[item.id] || null }));
    }

    async findById(idOrKey: string, includeArchived: boolean = false) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
        const where: any = isUUID ? { id: idOrKey } : { key: idOrKey };
        if (!includeArchived) {
            where.deletedAt = null;
        }
        const item = await prisma.workItem.findFirst({
            where,
            include: {
                assignee: { select: { id: true, firstName: true, lastName: true } },
                reporter: { select: { id: true, firstName: true, lastName: true } },
                parent: { select: { id: true, title: true, itemType: true } },
                children: {
                    where: { deletedAt: null },
                    include: {
                        assignee: { select: { id: true, firstName: true, lastName: true } }
                    }
                },
                testCases: {
                    where: { deletedAt: null },
                    include: {
                        runItems: {
                            include: {
                                testRun: {
                                    select: {
                                        id: true,
                                        title: true,
                                        status: true,
                                        createdAt: true,
                                    }
                                }
                            }
                        }
                    }
                },
                comments: {
                    include: { author: { select: { id: true, firstName: true, lastName: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                worklogs: {
                    where: { deletedAt: null },
                    include: { user: { select: { id: true, firstName: true, lastName: true } } },
                    orderBy: { startedAt: 'desc' }
                },
                commits: {
                    orderBy: { date: 'desc' }
                },
                pullRequests: {
                    orderBy: { createdAt: 'desc' }
                },
                sourceRequest: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    }
                }
            },
        });
        if (!item) {
            return item;
        }

        if (item.sourceRequest) {
            const releaseCandidateModel = (prisma as any).releaseCandidate;
            const releaseCandidates = releaseCandidateModel?.findMany
                ? await releaseCandidateModel.findMany({
                    where: { sourceRequestId: item.sourceRequest.id, deletedAt: null },
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        readinessScore: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                })
                : [];

            const aiJob = await getAIJob('WorkItem', item.id);
            return this.sanitizeWorkItem({
                ...item,
                aiJob,
                sourceRequest: {
                    ...item.sourceRequest,
                    releaseCandidates,
                }
            });
        }

        const aiJob = await getAIJob('WorkItem', item.id);
        return this.sanitizeWorkItem({ ...item, aiJob });
    }

    async archive(id: string, actorId?: string) {
        const existing = await prisma.workItem.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('WorkItem not found', 404);
        }

        const archived = await prisma.workItem.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        if (actorId) {
            await auditService.logDelete(
                { actorId, projectId: existing.projectId },
                'WorkItem',
                id,
                existing
            );
        }

        return archived;
    }

    async restore(id: string, actorId?: string) {
        const existing = await prisma.workItem.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('WorkItem not found', 404);
        }

        const restored = await prisma.workItem.update({
            where: { id },
            data: { deletedAt: null }
        });

        if (actorId) {
            await auditService.logUpdate(
                { actorId, projectId: existing.projectId },
                'WorkItem',
                id,
                existing,
                restored
            );
        }

        return restored;
    }

    async hardDelete(id: string, actorId?: string) {
        const existing = await prisma.workItem.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('WorkItem not found', 404);
        }
        await dataGovernanceService.assertPermanentDeletionAllowed(existing.projectId);

        const result = await prisma.workItem.delete({
            where: { id },
        });

        if (actorId) {
            await auditService.logDelete(
                { actorId, projectId: existing.projectId },
                'WorkItem (Hard Delete)',
                id,
                existing
            );
        }

        return result;
    }

    async delete(id: string, actorId?: string) {
        return this.archive(id, actorId);
    }

    async update(idOrKey: string, data: Record<string, unknown>, actorId?: string) {
        // Support both UUID and project-scoped key (e.g. "NE-2")
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
        const lookupWhere: any = isUUID
            ? { id: idOrKey, deletedAt: null }
            : { key: idOrKey, deletedAt: null };

        const current = await prisma.workItem.findFirst({
            where: lookupWhere,
            select: {
                id: true,
                projectId: true,
                itemType: true,
                parentId: true,
                description: true,
                status: true,
                testResultId: true,
                foundInEnvId: true
                ,sprintId: true,
                customFields: true,
                workTypeId: true
            }
        });

        if (!current) {
            throw new AppError('WorkItem not found', 404);
        }

        const normalized = this.normalizePayload(data);
        if (Object.prototype.hasOwnProperty.call(normalized, 'sprintId') && normalized.sprintId !== current.sprintId) {
            const targetSprintId = normalized.sprintId ? String(normalized.sprintId) : null;
            const protectedSprintIds = [current.sprintId, targetSprintId].filter(Boolean) as string[];
            if (protectedSprintIds.length) {
                const locked = await prisma.sprintPlanningSession.findFirst({ where: { sprintId: { in: protectedSprintIds }, status: { in: ['LOCKED', 'COMPLETED'] } }, select: { sprintId: true, status: true } });
                if (locked) throw new AppError('Sprint planı kilitli. Kapsam değişikliği için planlama oturumunu yeniden açın.', 409);
            }
            normalized.sprintAddedAt = targetSprintId ? new Date() : null;
        }
        const documentationField = this.parseDocumentationPageField(normalized);
        delete normalized.documentationPageId;

        const nextItemType = Object.prototype.hasOwnProperty.call(normalized, 'itemType')
            ? this.parseWorkItemType(normalized.itemType)
            : current.itemType;
        normalized.itemType = nextItemType;

        if (
            Object.prototype.hasOwnProperty.call(normalized, 'customFields')
            || Object.prototype.hasOwnProperty.call(normalized, 'workTypeId')
            || nextItemType !== current.itemType
        ) {
            normalized.customFields = await workConfigurationService.validateWorkItemFields(
                current.projectId,
                nextItemType,
                Object.prototype.hasOwnProperty.call(normalized, 'workTypeId') ? normalized.workTypeId : current.workTypeId,
                Object.prototype.hasOwnProperty.call(normalized, 'customFields')
                    ? { ...(current.customFields as Record<string, unknown> || {}), ...(normalized.customFields as Record<string, unknown> || {}) }
                    : current.customFields,
            );
        }

        const hasParentUpdate = Object.prototype.hasOwnProperty.call(normalized, 'parentId');
        const nextParentId = hasParentUpdate
            ? this.normalizeNullableString(normalized.parentId, 'parentId')
            : current.parentId;
        normalized.parentId = nextParentId;

        const shouldValidateParentEpic = nextItemType === WorkItemType.STORY
            && !!nextParentId
            && (hasParentUpdate || current.itemType !== WorkItemType.STORY);

        if (shouldValidateParentEpic && nextParentId) {
            await this.assertParentEpicHasDocumentation(nextParentId, current.projectId);
        }

        const currentMeta = extractDocumentationMeta(current.description);
        const nextDocumentationPageId = documentationField.provided
            ? documentationField.value
            : currentMeta.documentationPageId;

        if (nextItemType === WorkItemType.EPIC && !nextDocumentationPageId) {
            throw new AppError('documentationPageId is required for epic update', 400);
        }

        if (nextDocumentationPageId) {
            await this.assertDocumentationPageBelongsToProject(nextDocumentationPageId, current.projectId);
        }

        const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(normalized, 'description');
        const descriptionSource = hasDescriptionUpdate
            ? this.normalizeOptionalText(normalized.description, 'description')
            : current.description;
        const shouldRewriteDescription = nextItemType === WorkItemType.EPIC
            || current.itemType === WorkItemType.EPIC
            || hasDescriptionUpdate
            || documentationField.provided;

        if (shouldRewriteDescription) {
            normalized.description = buildDescriptionWithDocumentation(
                descriptionSource,
                nextItemType === WorkItemType.EPIC ? nextDocumentationPageId : null
            );
        } else {
            delete normalized.description;
        }

        const nextStatus = Object.prototype.hasOwnProperty.call(normalized, 'status')
            ? String(normalized.status)
            : current.status;

        if (nextStatus !== current.status) {
            assertWorkItemTransition(nextItemType, current.status, nextStatus);
            await WorkItemPolicyService.assertCompletion(current.id, nextStatus);
        }

        if (nextStatus !== current.status && actorId) {
            if (nextItemType === WorkItemType.BUG) {
                await workflowGateService.assertBugTraceability({
                    id: current.id,
                    status: nextStatus,
                    testResultId: Object.prototype.hasOwnProperty.call(normalized, 'testResultId') ? String(normalized.testResultId) : current.testResultId,
                    foundInEnvId: (normalized as any).foundInEnvId || current.foundInEnvId
                }, actorId, current.projectId);
            }
            if (nextStatus === 'IN_PROGRESS') {
                await workflowGateService.assertWorkItemReadyForDevelopment({
                    id: current.id,
                    itemType: nextItemType,
                    description: shouldRewriteDescription ? normalized.description as string : current.description,
                    parentId: nextParentId
                }, actorId, current.projectId);
            }
            if (nextStatus === 'READY_FOR_TEST' || nextStatus === 'QA') {
                const testCasesCount = await prisma.testCase.count({ where: { workItemId: current.id, deletedAt: null } });
                const openPRCount = await prisma.pullRequest.count({ where: { workItemId: current.id, state: 'open' } });
                await workflowGateService.assertWorkItemReadyForQA({
                    id: current.id,
                    itemType: nextItemType
                }, testCasesCount, openPRCount, actorId, current.projectId);
            }
            if (nextStatus === 'DONE' || nextStatus === 'RESOLVED') {
                await workflowGateService.assertWorkItemReadyForDone({
                    id: current.id,
                    itemType: nextItemType
                }, actorId, current.projectId);
            }
        }

        if (nextStatus !== current.status) {
            const mappedColumn = await prisma.boardColumn.findFirst({
                where: {
                    projectId: current.projectId,
                    mappedStatus: nextStatus as WorkItemStatus,
                },
                orderBy: { orderIndex: 'asc' },
                select: { id: true },
            });

            if (mappedColumn) {
                normalized.boardColumnId = mappedColumn.id;
            }
        }

        if (!(normalized as any).foundInEnvId && (normalized as any).foundInEnv) {
            const env = await environmentService.findOrCreateByName(current.projectId, String((normalized as any).foundInEnv));
            (normalized as any).foundInEnvId = env.id;
        }
        delete (normalized as any).foundInEnv;

        const updated = await prisma.workItem.update({
            where: { id: current.id },
            data: {
                ...normalized as any,
                documentationPageId: nextItemType === WorkItemType.EPIC ? nextDocumentationPageId : undefined
            }
        });

        if (actorId) {
            await impactAnalysisService.analyzeWorkItemChange(updated.id, actorId, {
                title: Object.prototype.hasOwnProperty.call(normalized, 'title'),
                description: shouldRewriteDescription
            });

            await artifactService.createRevision({
                entityType: 'WorkItem',
                entityId: updated.id,
                body: updated,
                authorId: actorId,
                status: 'PUBLISHED'
            });

            await auditService.logUpdate(
                { actorId, projectId: current.projectId },
                'WorkItem',
                updated.id,
                current,
                updated
            );
        }

        // Index for Project Memory

        knowledgeService.indexEntity(updated.projectId, 'WorkItem', updated.id, `${updated.title}\n${updated.description || ''}`);
        
        // Broadcast real-time update to project room
        const { SocketService } = require('./socket.service');
        SocketService.getInstance().broadcastProjectEvent(updated.projectId, 'board_update', { workItemId: updated.id, type: 'UPDATE' });

        if (actorId) {
            const trigger = nextStatus !== current.status ? 'STATUS_CHANGED' : 'WORK_ITEM_UPDATED';
            runInBackground(
                () => workAutomationService.dispatch(trigger, updated.projectId, updated.id, actorId),
                (error) => automationLogger.error(`${trigger} dispatch failed`, error),
            );
        }

        return this.sanitizeWorkItem(updated);
    }

    private normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
        const normalized: Record<string, unknown> = { ...payload };

        if (Object.prototype.hasOwnProperty.call(normalized, 'epicId') && !Object.prototype.hasOwnProperty.call(normalized, 'parentId')) {
            normalized.parentId = normalized.epicId;
        }
        delete normalized.epicId;

        if (Object.prototype.hasOwnProperty.call(normalized, 'points') && !Object.prototype.hasOwnProperty.call(normalized, 'storyPoints')) {
            normalized.storyPoints = this.normalizeStoryPoints(normalized.points);
        }
        delete normalized.points;

        if (Object.prototype.hasOwnProperty.call(normalized, 'storyPoints')) {
            normalized.storyPoints = this.normalizeStoryPoints(normalized.storyPoints);
        }

        return normalized;
    }

    private parseWorkItemType(value: unknown): WorkItemType {
        if (typeof value !== 'string') {
            throw new AppError('itemType is required', 400);
        }

        const normalized = value.toUpperCase();
        if (!Object.values(WorkItemType).includes(normalized as WorkItemType)) {
            throw new AppError(`Invalid itemType: ${value}`, 400);
        }

        return normalized as WorkItemType;
    }

    private requireNonEmptyString(value: unknown, fieldName: string): string {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AppError(`${fieldName} is required`, 400);
        }
        return value.trim();
    }

    private optionalNonEmptyString(value: unknown): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private normalizeOptionalText(value: unknown, fieldName: string): string | null | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new AppError(`${fieldName} must be a string`, 400);
        }
        return value;
    }

    private normalizeNullableString(value: unknown, fieldName: string): string | null | undefined {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new AppError(`${fieldName} must be a string`, 400);
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private normalizeStoryPoints(value: unknown): number | null | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (value === null || value === '') {
            return null;
        }

        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric)) {
            throw new AppError('storyPoints must be a valid number', 400);
        }

        return Math.max(0, Math.round(numeric));
    }

    private parseDocumentationPageField(payload: Record<string, unknown>): { provided: boolean; value: string | null } {
        if (!Object.prototype.hasOwnProperty.call(payload, 'documentationPageId')) {
            return { provided: false, value: null };
        }

        const rawValue = payload.documentationPageId;
        if (rawValue === null || rawValue === undefined) {
            return { provided: true, value: null };
        }

        if (typeof rawValue !== 'string') {
            throw new AppError('documentationPageId must be a string', 400);
        }

        const trimmed = rawValue.trim();
        return { provided: true, value: trimmed.length > 0 ? trimmed : null };
    }

    private async assertDocumentationPageBelongsToProject(pageId: string, projectId: string) {
        const wikiPage = await prisma.wikiPage.findFirst({
            where: {
                id: pageId,
                space: {
                    projectId
                }
            },
            select: { id: true }
        });

        if (!wikiPage) {
            throw new AppError('Selected documentation page does not belong to this project', 400);
        }
    }

    private async assertParentEpicHasDocumentation(parentId: string, projectId: string) {
        const parentEpic = await prisma.workItem.findFirst({
            where: { id: parentId, projectId },
            select: {
                id: true,
                itemType: true,
                description: true
            }
        });

        if (!parentEpic || parentEpic.itemType !== WorkItemType.EPIC) {
            throw new AppError('Story must be linked to a valid epic', 400);
        }

        const parentEpicMeta = extractDocumentationMeta(parentEpic.description);
        if (!parentEpicMeta.documentationPageId) {
            throw new AppError('Selected epic is not linked to a documentation page', 400);
        }
    }

    private async assertRequirementBelongsToProject(requirementId: string, projectId: string) {
        const requirement = await prisma.requirement.findFirst({
            where: { id: requirementId, projectId },
            select: { id: true, status: true }
        });

        if (!requirement) {
            throw new AppError('Selected requirement does not belong to this project', 400);
        }

        if (requirement.status === 'DRAFT') {
            throw new AppError('Cannot link WorkItems to a DRAFT requirement. Requirement must be approved.', 400);
        }
    }

    private sanitizeWorkItem<T extends Record<string, unknown>>(item: T): T & { documentationPageId: string | null } {
        const sanitized: Record<string, unknown> = { ...item };

        const docMeta = extractDocumentationMeta((sanitized.description as string | null | undefined) ?? null);
        if (Object.prototype.hasOwnProperty.call(sanitized, 'description')) {
            sanitized.description = docMeta.description;
        }
        sanitized.documentationPageId = docMeta.documentationPageId;

        if (Array.isArray(sanitized.children)) {
            sanitized.children = sanitized.children.map((child) =>
                this.sanitizeWorkItem((child as Record<string, unknown>))
            );
        }

        return sanitized as T & { documentationPageId: string | null };
    }
}

export const workItemService = new WorkItemService();
