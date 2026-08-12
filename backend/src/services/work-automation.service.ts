import { createHash, randomUUID } from 'node:crypto';
import { WorkAutomationRuleStatus, WorkAutomationTrigger } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { nqlService } from './nql.service';
import { NotificationService, NotificationType } from './notification.service';

type AutomationAction =
    | { type: 'ASSIGN'; userId: string }
    | { type: 'SET_PRIORITY'; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }
    | { type: 'ADD_COMMENT'; body: string }
    | { type: 'NOTIFY_ASSIGNEE'; title: string; message: string };

const triggers = new Set(Object.values(WorkAutomationTrigger));
const statuses = new Set(Object.values(WorkAutomationRuleStatus));

export class WorkAutomationService {
    async list(projectId: string) {
        return prisma.workAutomationRule.findMany({
            where: { projectId, status: { not: 'ARCHIVED' } },
            include: { _count: { select: { executions: true } } },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async executions(projectId: string, ruleId?: string) {
        return prisma.workAutomationExecution.findMany({
            where: { projectId, ...(ruleId ? { ruleId } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }

    async create(projectId: string, actorId: string, input: Record<string, unknown>) {
        const name = this.text(input.name, 'name', 100);
        const trigger = String(input.trigger || '') as WorkAutomationTrigger;
        if (!triggers.has(trigger)) throw new AppError('Invalid automation trigger', 400);
        const condition = typeof input.nqlCondition === 'string' ? input.nqlCondition.trim() || null : null;
        if (condition) nqlService.compile(condition, actorId);
        const actions = await this.actions(projectId, input.actions);
        return prisma.workAutomationRule.create({
            data: { projectId, createdById: actorId, name, trigger, nqlCondition: condition, actions, description: typeof input.description === 'string' ? input.description.trim() || null : null },
        });
    }

    async update(projectId: string, id: string, actorId: string, input: Record<string, unknown>) {
        const existing = await this.rule(projectId, id);
        const data: Record<string, unknown> = { version: { increment: 1 } };
        if ('name' in input) data.name = this.text(input.name, 'name', 100);
        if ('description' in input) data.description = typeof input.description === 'string' ? input.description.trim() || null : null;
        if ('trigger' in input) {
            const trigger = String(input.trigger) as WorkAutomationTrigger;
            if (!triggers.has(trigger)) throw new AppError('Invalid automation trigger', 400);
            data.trigger = trigger;
        }
        if ('nqlCondition' in input) {
            const condition = typeof input.nqlCondition === 'string' ? input.nqlCondition.trim() || null : null;
            if (condition) nqlService.compile(condition, actorId);
            data.nqlCondition = condition;
        }
        if ('actions' in input) data.actions = await this.actions(projectId, input.actions);
        if ('status' in input) {
            const status = String(input.status) as WorkAutomationRuleStatus;
            if (!statuses.has(status)) throw new AppError('Invalid automation status', 400);
            data.status = status;
        }
        return prisma.workAutomationRule.update({ where: { id: existing.id }, data: data as never });
    }

    async dryRun(projectId: string, id: string, workItemId: string, actorId: string) {
        const rule = await this.rule(projectId, id);
        const item = await prisma.workItem.findFirst({ where: { id: workItemId, projectId, deletedAt: null } });
        if (!item) throw new AppError('Work item not found', 404);
        const matches = await this.matches(rule.nqlCondition, projectId, workItemId, actorId);
        return { matches, workItem: { id: item.id, key: item.key, title: item.title }, plannedActions: matches ? rule.actions : [] };
    }

    async dispatch(trigger: WorkAutomationTrigger, projectId: string, workItemId: string, actorId: string, eventId = randomUUID()) {
        const rules = await prisma.workAutomationRule.findMany({ where: { projectId, trigger, status: 'ACTIVE' } });
        return Promise.all(rules.map((rule) => this.execute(rule, workItemId, actorId, eventId)));
    }

    async runManual(projectId: string, id: string, workItemId: string, actorId: string) {
        const rule = await this.rule(projectId, id);
        return this.execute(rule, workItemId, actorId, randomUUID(), true);
    }

    private async execute(rule: { id: string; projectId: string; trigger: WorkAutomationTrigger; nqlCondition: string | null; actions: unknown; createdById: string }, workItemId: string, actorId: string, eventId: string, force = false) {
        const idempotencyKey = createHash('sha256').update(`${rule.id}:${eventId}:${workItemId}`).digest('hex');
        const existing = await prisma.workAutomationExecution.findUnique({ where: { idempotencyKey } });
        if (existing) return existing;
        const execution = await prisma.workAutomationExecution.create({ data: { projectId: rule.projectId, ruleId: rule.id, workItemId, trigger: rule.trigger, idempotencyKey, input: { actorId, force } } });
        const started = Date.now();
        try {
            if (!await this.matches(rule.nqlCondition, rule.projectId, workItemId, actorId)) {
                return prisma.workAutomationExecution.update({ where: { id: execution.id }, data: { status: 'SKIPPED', startedAt: new Date(started), completedAt: new Date(), durationMs: Date.now() - started, actionResults: [] } });
            }
            await prisma.workAutomationExecution.update({ where: { id: execution.id }, data: { status: 'RUNNING', startedAt: new Date(started) } });
            const results: Array<Record<string, unknown>> = [];
            for (const action of rule.actions as unknown as AutomationAction[]) results.push(await this.apply(action, workItemId, rule.createdById));
            await prisma.workAutomationRule.update({ where: { id: rule.id }, data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() } });
            return prisma.workAutomationExecution.update({ where: { id: execution.id }, data: { status: 'SUCCEEDED', completedAt: new Date(), durationMs: Date.now() - started, actionResults: results as never } });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Automation failed';
            return prisma.workAutomationExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', error: message.slice(0, 2000), completedAt: new Date(), durationMs: Date.now() - started } });
        }
    }

    private async apply(action: AutomationAction, workItemId: string, authorId: string) {
        if (action.type === 'ASSIGN') {
            const item = await prisma.workItem.update({ where: { id: workItemId }, data: { assigneeId: action.userId } });
            return { type: action.type, assigneeId: item.assigneeId };
        }
        if (action.type === 'SET_PRIORITY') {
            const item = await prisma.workItem.update({ where: { id: workItemId }, data: { priority: action.priority } });
            return { type: action.type, priority: item.priority };
        }
        if (action.type === 'ADD_COMMENT') {
            const comment = await prisma.comment.create({ data: { workItemId, authorId, content: action.body } });
            return { type: action.type, commentId: comment.id };
        }
        const item = await prisma.workItem.findUnique({ where: { id: workItemId }, select: { assigneeId: true, key: true } });
        if (item?.assigneeId) await new NotificationService().notifyUser(item.assigneeId, { title: action.title, message: action.message, type: NotificationType.INFO, data: { workItemId, key: item.key } });
        return { type: action.type, notified: Boolean(item?.assigneeId) };
    }

    private async matches(condition: string | null, projectId: string, workItemId: string, actorId: string) {
        if (!condition) return true;
        const compiled = nqlService.compile(condition, actorId);
        return Boolean(await prisma.workItem.findFirst({ where: { id: workItemId, projectId, deletedAt: null, ...compiled.where }, select: { id: true } }));
    }

    private async actions(projectId: string, value: unknown): Promise<AutomationAction[]> {
        if (!Array.isArray(value) || !value.length || value.length > 10) throw new AppError('actions must contain 1 to 10 actions', 400);
        const actions = value.map((raw) => {
            if (!raw || typeof raw !== 'object') throw new AppError('Invalid automation action', 400);
            const action = raw as Record<string, unknown>;
            const type = String(action.type || '');
            if (type === 'ASSIGN') return { type, userId: this.text(action.userId, 'userId', 100) };
            if (type === 'SET_PRIORITY' && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(action.priority))) {
                return { type, priority: String(action.priority) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
            }
            if (type === 'ADD_COMMENT') return { type, body: this.text(action.body, 'body', 5000) };
            if (type === 'NOTIFY_ASSIGNEE') return { type, title: this.text(action.title, 'title', 100), message: this.text(action.message, 'message', 1000) };
            throw new AppError(`Unsupported automation action: ${type}`, 400);
        }) as AutomationAction[];
        const assigneeIds = actions.filter((action): action is Extract<AutomationAction, { type: 'ASSIGN' }> => action.type === 'ASSIGN').map((action) => action.userId);
        if (assigneeIds.length) {
            const memberCount = await prisma.projectMember.count({ where: { projectId, userId: { in: Array.from(new Set(assigneeIds)) } } });
            if (memberCount !== new Set(assigneeIds).size) throw new AppError('Automation assignee must be a project member', 400);
        }
        return actions;
    }

    private async rule(projectId: string, id: string) {
        const rule = await prisma.workAutomationRule.findFirst({ where: { id, projectId } });
        if (!rule) throw new AppError('Automation rule not found', 404);
        return rule;
    }

    private text(value: unknown, field: string, max: number) {
        if (typeof value !== 'string' || !value.trim()) throw new AppError(`${field} is required`, 400);
        if (value.trim().length > max) throw new AppError(`${field} is too long`, 400);
        return value.trim();
    }
}

export const workAutomationService = new WorkAutomationService();
