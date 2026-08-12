import { randomUUID } from 'node:crypto';
import { WorkItemStatus, WorkItemType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

type WorkflowColumn = { id: string; name: string; orderIndex: number; mappedStatus: WorkItemStatus | null; wipLimit: number | null; color: string | null; allowedTransitions: string[] };
type WorkflowPolicy = { itemType: WorkItemType; requiresTestsForDone: boolean; requiresPassingTest: boolean; requiresWorklogForDone: boolean; minimumLoggedMinutes: number; requiredFields: string[] };
export type WorkflowTransition = {
    id: string;
    name: string;
    fromColumnId: string;
    toColumnId: string;
    itemTypes: WorkItemType[];
    conditions: Array<{ type: 'ROLE_ALLOWED' | 'ASSIGNEE_REQUIRED' | 'PRIORITY_ALLOWED'; values: string[] }>;
    validators: Array<{ type: 'REQUIRED_FIELDS' | 'MIN_WORKLOG' | 'TEST_CASE_REQUIRED'; fields?: string[]; minimumMinutes?: number }>;
    postActions: Array<{ type: 'SET_PRIORITY' | 'ASSIGN_REPORTER' | 'ADD_COMMENT'; value?: string }>;
};
type WorkflowConfig = { columns: WorkflowColumn[]; policies: WorkflowPolicy[]; transitions: WorkflowTransition[] };

export class WorkflowSchemeService {
    async get(projectId: string) {
        let scheme = await prisma.workflowScheme.findUnique({ where: { projectId }, include: { revisions: { orderBy: { version: 'desc' }, take: 20, include: { publishedBy: { select: { id: true, firstName: true, lastName: true } } } } } });
        if (!scheme) {
            const config = await this.snapshot(projectId);
            scheme = await prisma.workflowScheme.create({ data: { projectId, name: 'Project workflow', draftConfig: config as never }, include: { revisions: { include: { publishedBy: { select: { id: true, firstName: true, lastName: true } } } } } });
        }
        return scheme;
    }

    async saveDraft(projectId: string, config: unknown) {
        const validated = this.validate(config);
        const scheme = await this.get(projectId);
        return prisma.workflowScheme.update({ where: { id: scheme.id }, data: { draftConfig: validated as never, status: 'DRAFT' } });
    }

    async refreshDraftFromLive(projectId: string) {
        const scheme = await this.get(projectId);
        const config = await this.snapshot(projectId);
        return prisma.workflowScheme.update({ where: { id: scheme.id }, data: { draftConfig: config as never, status: 'DRAFT' } });
    }

    validate(config: unknown): WorkflowConfig {
        if (!config || typeof config !== 'object') throw new AppError('Workflow config is required', 400);
        const raw = config as Record<string, unknown>;
        if (!Array.isArray(raw.columns) || raw.columns.length < 2 || raw.columns.length > 30) throw new AppError('Workflow requires 2 to 30 columns', 400);
        const ids = new Set<string>();
        const statuses = new Set(Object.values(WorkItemStatus));
        const columns = raw.columns.map((value, index) => {
            if (!value || typeof value !== 'object') throw new AppError('Invalid workflow column', 400);
            const column = value as Record<string, unknown>;
            const id = typeof column.id === 'string' && column.id ? column.id : randomUUID();
            if (ids.has(id)) throw new AppError('Workflow column IDs must be unique', 400);
            ids.add(id);
            const name = typeof column.name === 'string' ? column.name.trim() : '';
            if (!name) throw new AppError('Workflow column name is required', 400);
            const mappedStatus = column.mappedStatus ? String(column.mappedStatus) as WorkItemStatus : null;
            if (mappedStatus && !statuses.has(mappedStatus)) throw new AppError(`Invalid workflow status: ${mappedStatus}`, 400);
            return { id, name, orderIndex: index, mappedStatus, wipLimit: column.wipLimit ? Math.max(1, Number(column.wipLimit)) : null, color: typeof column.color === 'string' ? column.color : null, allowedTransitions: Array.isArray(column.allowedTransitions) ? column.allowedTransitions.map(String) : [] };
        });
        for (const column of columns) if (column.allowedTransitions.some((id) => !ids.has(id))) throw new AppError(`Unknown transition target in ${column.name}`, 400);
        const itemTypes = new Set(Object.values(WorkItemType));
        const policies = (Array.isArray(raw.policies) ? raw.policies : []).map((value) => {
            const policy = value as Record<string, unknown>;
            const itemType = String(policy.itemType) as WorkItemType;
            if (!itemTypes.has(itemType)) throw new AppError(`Invalid policy item type: ${itemType}`, 400);
            return { itemType, requiresTestsForDone: Boolean(policy.requiresTestsForDone), requiresPassingTest: Boolean(policy.requiresPassingTest), requiresWorklogForDone: Boolean(policy.requiresWorklogForDone), minimumLoggedMinutes: Math.max(0, Number(policy.minimumLoggedMinutes) || 0), requiredFields: Array.isArray(policy.requiredFields) ? policy.requiredFields.map(String).filter(Boolean) : [] };
        });
        const transitionIds = new Set<string>();
        const transitions = (Array.isArray(raw.transitions) ? raw.transitions : []).map((value) => {
            if (!value || typeof value !== 'object') throw new AppError('Invalid workflow transition', 400);
            const transition = value as Record<string, unknown>;
            const id = typeof transition.id === 'string' && transition.id ? transition.id : randomUUID();
            if (transitionIds.has(id)) throw new AppError('Workflow transition IDs must be unique', 400);
            transitionIds.add(id);
            const name = typeof transition.name === 'string' ? transition.name.trim() : '';
            const fromColumnId = String(transition.fromColumnId || '');
            const toColumnId = String(transition.toColumnId || '');
            if (!name || !ids.has(fromColumnId) || !ids.has(toColumnId) || fromColumnId === toColumnId) throw new AppError('Transition requires a name and two different valid columns', 400);
            const transitionItemTypes = (Array.isArray(transition.itemTypes) ? transition.itemTypes : []).map(String) as WorkItemType[];
            if (transitionItemTypes.some((type) => !itemTypes.has(type))) throw new AppError(`Invalid transition item type in ${name}`, 400);
            const conditions = (Array.isArray(transition.conditions) ? transition.conditions : []).map((entry) => {
                const condition = entry as Record<string, unknown>;
                const type = String(condition.type) as WorkflowTransition['conditions'][number]['type'];
                if (!['ROLE_ALLOWED', 'ASSIGNEE_REQUIRED', 'PRIORITY_ALLOWED'].includes(type)) throw new AppError(`Invalid transition condition in ${name}`, 400);
                const values = Array.isArray(condition.values) ? condition.values.map(String).filter(Boolean) : [];
                if (type !== 'ASSIGNEE_REQUIRED' && values.length === 0) throw new AppError(`Transition condition ${type} requires values`, 400);
                return { type, values };
            });
            const validators = (Array.isArray(transition.validators) ? transition.validators : []).map((entry) => {
                const validator = entry as Record<string, unknown>;
                const type = String(validator.type) as WorkflowTransition['validators'][number]['type'];
                if (!['REQUIRED_FIELDS', 'MIN_WORKLOG', 'TEST_CASE_REQUIRED'].includes(type)) throw new AppError(`Invalid transition validator in ${name}`, 400);
                const fields = Array.isArray(validator.fields) ? validator.fields.map(String).filter(Boolean) : undefined;
                const minimumMinutes = type === 'MIN_WORKLOG' ? Math.max(1, Number(validator.minimumMinutes) || 0) : undefined;
                if (type === 'REQUIRED_FIELDS' && !fields?.length) throw new AppError('REQUIRED_FIELDS validator requires fields', 400);
                if (type === 'MIN_WORKLOG' && !minimumMinutes) throw new AppError('MIN_WORKLOG validator requires minimumMinutes', 400);
                return { type, fields, minimumMinutes };
            });
            const postActions = (Array.isArray(transition.postActions) ? transition.postActions : []).map((entry) => {
                const action = entry as Record<string, unknown>;
                const type = String(action.type) as WorkflowTransition['postActions'][number]['type'];
                if (!['SET_PRIORITY', 'ASSIGN_REPORTER', 'ADD_COMMENT'].includes(type)) throw new AppError(`Invalid transition post-action in ${name}`, 400);
                const actionValue = typeof action.value === 'string' ? action.value.trim() : undefined;
                if ((type === 'SET_PRIORITY' || type === 'ADD_COMMENT') && !actionValue) throw new AppError(`Post-action ${type} requires a value`, 400);
                if (type === 'SET_PRIORITY' && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(actionValue!)) throw new AppError(`Invalid post-action priority: ${actionValue}`, 400);
                return { type, value: actionValue };
            });
            return { id, name, fromColumnId, toColumnId, itemTypes: transitionItemTypes, conditions, validators, postActions };
        });
        for (const transition of transitions) {
            const source = columns.find((column) => column.id === transition.fromColumnId)!;
            if (source.allowedTransitions.length > 0 && !source.allowedTransitions.includes(transition.toColumnId)) {
                throw new AppError(`Transition "${transition.name}" targets a column not allowed by its source column`, 400);
            }
        }
        for (let index = 0; index < transitions.length; index++) {
            const current = transitions[index];
            const overlapping = transitions.slice(index + 1).find((candidate) => {
                if (candidate.fromColumnId !== current.fromColumnId || candidate.toColumnId !== current.toColumnId) return false;
                if (candidate.itemTypes.length === 0 || current.itemTypes.length === 0) return true;
                return candidate.itemTypes.some((type) => current.itemTypes.includes(type));
            });
            if (overlapping) throw new AppError(`Ambiguous workflow transitions: "${current.name}" and "${overlapping.name}" overlap`, 400);
        }
        return { columns, policies, transitions };
    }

    async publish(projectId: string, actorId: string, changeNote?: string) {
        const scheme = await this.get(projectId);
        const config = this.validate(scheme.draftConfig);
        const nextVersion = scheme.publishedVersion + 1;
        await prisma.$transaction(async (tx) => {
            const existing = await tx.boardColumn.findMany({ where: { projectId }, select: { id: true, _count: { select: { workItems: true } } } });
            const nextIds = new Set(config.columns.map((column) => column.id));
            const blockedRemoval = existing.find((column) => !nextIds.has(column.id) && column._count.workItems > 0);
            if (blockedRemoval) throw new AppError('A column containing work items cannot be removed during publish', 409);
            await tx.boardColumn.deleteMany({ where: { projectId, id: { notIn: [...nextIds] } } });
            for (const column of config.columns) {
                await tx.boardColumn.upsert({
                    where: { id: column.id },
                    create: { ...column, projectId, isDefault: false, mappedStatus: column.mappedStatus },
                    update: { name: column.name, orderIndex: column.orderIndex, mappedStatus: column.mappedStatus, wipLimit: column.wipLimit, color: column.color, allowedTransitions: column.allowedTransitions },
                });
            }
            await tx.workItemPolicy.deleteMany({
                where: { projectId, itemType: { notIn: config.policies.map((policy) => policy.itemType) } },
            });
            for (const policy of config.policies) await tx.workItemPolicy.upsert({ where: { projectId_itemType: { projectId, itemType: policy.itemType } }, create: { projectId, ...policy }, update: policy });
            await tx.workflowRevision.create({ data: { schemeId: scheme.id, version: nextVersion, config: config as never, changeNote: changeNote?.trim() || null, publishedById: actorId } });
            await tx.workflowScheme.update({ where: { id: scheme.id }, data: { status: 'PUBLISHED', publishedVersion: nextVersion, publishedConfig: config as never, draftConfig: config as never } });
        });
        return this.get(projectId);
    }

    async restoreRevision(projectId: string, revisionId: string) {
        const scheme = await this.get(projectId);
        const revision = await prisma.workflowRevision.findFirst({ where: { id: revisionId, schemeId: scheme.id } });
        if (!revision) throw new AppError('Workflow revision not found', 404);
        return prisma.workflowScheme.update({ where: { id: scheme.id }, data: { draftConfig: revision.config as never, status: 'DRAFT' } });
    }

    private async snapshot(projectId: string): Promise<WorkflowConfig> {
        const [columns, policies] = await Promise.all([
            prisma.boardColumn.findMany({ where: { projectId }, orderBy: { orderIndex: 'asc' } }),
            prisma.workItemPolicy.findMany({ where: { projectId }, orderBy: { itemType: 'asc' } }),
        ]);
        return {
            columns: columns.map(({ id, name, orderIndex, mappedStatus, wipLimit, color, allowedTransitions }) => ({ id, name, orderIndex, mappedStatus, wipLimit, color, allowedTransitions })),
            policies: policies.map(({ itemType, requiresTestsForDone, requiresPassingTest, requiresWorklogForDone, minimumLoggedMinutes, requiredFields }) => ({ itemType, requiresTestsForDone, requiresPassingTest, requiresWorklogForDone, minimumLoggedMinutes, requiredFields })),
            transitions: [],
        };
    }
}
export const workflowSchemeService = new WorkflowSchemeService();
