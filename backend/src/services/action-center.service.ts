import {
    ActionItemStatus,
    ActionSeverity,
    BugSeverity,
    Prisma,
    Priority,
    WorkItemType,
} from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { randomUUID } from 'node:crypto';
import { redisClient } from './queue/connection';

export type ActionCenterActor = {
    userId: string;
    organizationId: string;
    role: string;
};

type ListInput = {
    mode?: unknown;
    search?: unknown;
    projectId?: unknown;
    assigneeId?: unknown;
    status?: unknown;
    severity?: unknown;
    page?: unknown;
    limit?: unknown;
};

type MutationInput = {
    status?: unknown;
    assigneeId?: unknown;
    dueDate?: unknown;
    snoozedUntil?: unknown;
    resolution?: unknown;
};

type ConversionInput = {
    projectId?: unknown;
    title?: unknown;
    description?: unknown;
    itemType?: unknown;
    priority?: unknown;
    assigneeId?: unknown;
    requirementId?: unknown;
    severity?: unknown;
    stepsToReproduce?: unknown;
};

type GeneratedAction = {
    projectId: string | null;
    assigneeId: string | null;
    sourceType: string;
    sourceId: string;
    actionType: string;
    dedupeKey: string;
    title: string;
    description: string;
    severity: ActionSeverity;
    dueDate: Date | null;
    actionUrl: string;
    metadata: Prisma.InputJsonValue;
};

const activeStatuses: ActionItemStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'];
const actionStatuses = new Set<ActionItemStatus>(['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']);
const actionSeverities = new Set<ActionSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const allowedModes = new Set(['mine', 'open', 'critical', 'snoozed']);
const systemActionTypes = ['FIX_CRITICAL_BUG', 'REMEDIATE_RELEASE_BLOCKER', 'MITIGATE_INITIATIVE_RISK', 'COMPLETE_OVERDUE_WORK'] as const;
const autoResolution = 'action_center.generated.auto_resolved';
const oneDay = 86_400_000;
const reconciliationLockTtlMs = 10 * 60 * 1000;

const itemInclude = {
    project: { select: { id: true, key: true, name: true } },
    assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
} satisfies Prisma.ActionCenterItemInclude;

const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const asTrimmedString = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
const metadataObject = (value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> => (
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {}
);

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

function parseDate(value: unknown, field: string) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' && !(value instanceof Date)) throw new AppError(`${field} geçerli bir tarih olmalıdır.`, 400);
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new AppError(`${field} geçerli bir tarih olmalıdır.`, 400);
    return parsed;
}

export class ActionCenterService {
    private readonly localReconciliationLocks = new Set<string>();

    private isAdmin(actor: ActionCenterActor) {
        return actor.role.toUpperCase() === 'ADMIN';
    }

    private isManager(actor: ActionCenterActor) {
        return ['ADMIN', 'TEAM_LEADER'].includes(actor.role.toUpperCase());
    }

    private assertManager(actor: ActionCenterActor) {
        if (!this.isManager(actor)) throw new AppError('Risk mutabakatını yenilemek için yönetici yetkisi gereklidir.', 403);
    }

    private async accessibleProjectIds(actor: ActionCenterActor) {
        if (this.isAdmin(actor)) {
            const projects = await prisma.project.findMany({
                where: { organizationId: actor.organizationId },
                select: { id: true },
            });
            return projects.map((project) => project.id);
        }
        const memberships = await prisma.projectMember.findMany({
            where: { userId: actor.userId, project: { organizationId: actor.organizationId } },
            select: { projectId: true },
        });
        return memberships.map((membership) => membership.projectId);
    }

    private visibilityWhere(actor: ActionCenterActor, projectIds: string[]): Prisma.ActionCenterItemWhereInput {
        if (this.isAdmin(actor)) return {};
        const organizationLevel: Prisma.ActionCenterItemWhereInput = this.isManager(actor)
            ? { projectId: null }
            : { projectId: null, OR: [{ assigneeId: actor.userId }, { createdById: actor.userId }] };
        return { OR: [{ projectId: { in: projectIds } }, organizationLevel] };
    }

    private async assertProjectAccess(actor: ActionCenterActor, projectId: string, projectIds?: string[]) {
        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId: actor.organizationId },
            select: { id: true, key: true, name: true, status: true },
        });
        if (!project) throw new AppError('Proje kurum kapsamında bulunamadı.', 404);
        const accessible = projectIds || await this.accessibleProjectIds(actor);
        if (!accessible.includes(projectId)) throw new AppError('Bu projedeki aksiyonlara erişim yetkiniz yok.', 403);
        return project;
    }

    private async buildWhere(actor: ActionCenterActor, input: ListInput, defaultMode: boolean) {
        const projectIds = await this.accessibleProjectIds(actor);
        const and: Prisma.ActionCenterItemWhereInput[] = [this.visibilityWhere(actor, projectIds)];
        const explicitStatus = typeof input.status === 'string' ? input.status.toUpperCase() as ActionItemStatus : undefined;
        if (explicitStatus && !actionStatuses.has(explicitStatus)) throw new AppError('Geçersiz aksiyon durumu.', 400);
        const explicitSeverity = typeof input.severity === 'string' ? input.severity.toUpperCase() as ActionSeverity : undefined;
        if (explicitSeverity && !actionSeverities.has(explicitSeverity)) throw new AppError('Geçersiz aksiyon kritiklik seviyesi.', 400);

        const requestedMode = typeof input.mode === 'string' && input.mode.trim() ? input.mode.trim().toLowerCase() : undefined;
        if (requestedMode && !allowedModes.has(requestedMode)) throw new AppError('Geçersiz aksiyon merkezi görünümü.', 400);
        const mode = requestedMode || (defaultMode && !explicitStatus ? 'open' : undefined);
        const now = new Date();
        const unsnoozed: Prisma.ActionCenterItemWhereInput = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] };
        if (mode === 'mine') and.push({ assigneeId: actor.userId, status: { in: activeStatuses } }, unsnoozed);
        if (mode === 'open') and.push({ status: { in: activeStatuses } }, unsnoozed);
        if (mode === 'critical') and.push({ status: { in: activeStatuses }, severity: 'CRITICAL' }, unsnoozed);
        if (mode === 'snoozed') and.push({ status: { in: activeStatuses }, snoozedUntil: { gt: now } });
        if (explicitStatus) and.push({ status: explicitStatus });
        if (explicitSeverity) and.push({ severity: explicitSeverity });

        const projectId = asTrimmedString(input.projectId, 80);
        if (projectId) {
            await this.assertProjectAccess(actor, projectId, projectIds);
            and.push({ projectId });
        }
        const assigneeId = asTrimmedString(input.assigneeId, 80);
        if (assigneeId) and.push({ assigneeId: assigneeId === 'me' ? actor.userId : assigneeId });
        const search = asTrimmedString(input.search, 120);
        if (search) and.push({ OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { actionType: { contains: search, mode: 'insensitive' } },
            { project: { is: { key: { contains: search, mode: 'insensitive' } } } },
        ] });
        return { where: { organizationId: actor.organizationId, AND: and } satisfies Prisma.ActionCenterItemWhereInput, projectIds };
    }

    async list(actor: ActionCenterActor, input: ListInput = {}) {
        const page = numberInRange(input.page, 1, 1, 100_000);
        const limit = numberInRange(input.limit, 25, 1, 100);
        const { where, projectIds } = await this.buildWhere(actor, input, true);
        const [items, total, projects, assignees] = await prisma.$transaction([
            prisma.actionCenterItem.findMany({
                where,
                include: itemInclude,
                orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.actionCenterItem.count({ where }),
            prisma.project.findMany({
                where: { organizationId: actor.organizationId, id: { in: projectIds }, status: 'ACTIVE' },
                select: { id: true, key: true, name: true },
                orderBy: { name: 'asc' },
            }),
            prisma.user.findMany({
                where: {
                    isActive: true,
                    deletedAt: null,
                    organizationMemberships: { some: { organizationId: actor.organizationId } },
                },
                select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            }),
        ]);
        return {
            items,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            facets: { projects, assignees },
        };
    }

    async summary(actor: ActionCenterActor, input: ListInput = {}) {
        const { where } = await this.buildWhere(actor, { ...input, mode: undefined }, false);
        const now = new Date();
        const dueSoon = new Date(now.getTime() + 3 * oneDay);
        const unsnoozed: Prisma.ActionCenterItemWhereInput = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] };
        const active: Prisma.ActionCenterItemWhereInput = { status: { in: activeStatuses } };
        const [mine, open, critical, snoozed, overdue, dueSoonCount] = await prisma.$transaction([
            prisma.actionCenterItem.count({ where: { AND: [where, active, unsnoozed, { assigneeId: actor.userId }] } }),
            prisma.actionCenterItem.count({ where: { AND: [where, active, unsnoozed] } }),
            prisma.actionCenterItem.count({ where: { AND: [where, active, unsnoozed, { severity: 'CRITICAL' }] } }),
            prisma.actionCenterItem.count({ where: { AND: [where, active, { snoozedUntil: { gt: now } }] } }),
            prisma.actionCenterItem.count({ where: { AND: [where, active, unsnoozed, { dueDate: { lt: now } }] } }),
            prisma.actionCenterItem.count({ where: { AND: [where, active, unsnoozed, { dueDate: { gte: now, lte: dueSoon } }] } }),
        ]);
        return { mine, open, critical, snoozed, overdue, dueSoon: dueSoonCount };
    }

    private async reconciliationProjectIds(actor: ActionCenterActor) {
        if (this.isAdmin(actor)) return this.accessibleProjectIds(actor);
        return this.accessibleProjectIds(actor);
    }

    async reconcile(actor: ActionCenterActor) {
        this.assertManager(actor);
        const lockKey = `nexa:action-center:reconcile:${actor.organizationId}`;
        if (this.localReconciliationLocks.has(lockKey)) throw new AppError('Bu kurum için risk uzlaştırması zaten devam ediyor.', 409);

        const lockOwner = randomUUID();
        const distributedLock = await redisClient.acquireLock(lockKey, lockOwner, reconciliationLockTtlMs);
        if (distributedLock === false) throw new AppError('Bu kurum için risk uzlaştırması zaten devam ediyor.', 409);
        this.localReconciliationLocks.add(lockKey);
        const heartbeat = distributedLock
            ? setInterval(() => void redisClient.renewLock(lockKey, lockOwner, reconciliationLockTtlMs), reconciliationLockTtlMs / 3)
            : undefined;
        heartbeat?.unref();

        try {
            return await this.reconcileUnlocked(actor);
        } finally {
            if (heartbeat) clearInterval(heartbeat);
            this.localReconciliationLocks.delete(lockKey);
            if (distributedLock) await redisClient.releaseLock(lockKey, lockOwner);
        }
    }

    private async reconcileUnlocked(actor: ActionCenterActor) {
        const seenAt = new Date();
        const projectIds = await this.reconciliationProjectIds(actor);
        const initiativeScope: Prisma.PortfolioInitiativeWhereInput = this.isAdmin(actor)
            ? { program: { portfolio: { organizationId: actor.organizationId } } }
            : { projectId: { in: projectIds }, program: { portfolio: { organizationId: actor.organizationId } } };
        const [bugs, releases, initiatives, overdueItems] = await Promise.all([
            prisma.workItem.findMany({
                where: {
                    projectId: { in: projectIds }, deletedAt: null,
                    itemType: { in: ['BUG', 'DEFECT'] }, severity: 'CRITICAL',
                    status: { notIn: ['DONE', 'CLOSED'] },
                },
                select: { id: true, key: true, title: true, description: true, projectId: true, assigneeId: true, updatedAt: true },
            }),
            prisma.releaseCandidate.findMany({
                where: { projectId: { in: projectIds }, deletedAt: null, status: { in: ['DRAFT', 'READY'] } },
                select: {
                    id: true, key: true, title: true, projectId: true, readinessScore: true, criticalOpenBugs: true,
                    failedRunItems: true, blockedRunItems: true, conflictRunItems: true, traceabilityGaps: true, openRuns: true,
                    project: { select: { qualityTier: true } },
                },
            }),
            prisma.portfolioInitiative.findMany({
                where: {
                    AND: [initiativeScope, { status: { notIn: ['DONE', 'CANCELLED'] } }],
                    OR: [{ status: { in: ['AT_RISK', 'BLOCKED'] } }, { targetDate: { lt: seenAt } }],
                },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    status: true,
                    priority: true,
                    projectId: true,
                    targetDate: true,
                    ownerId: true,
                    program: { select: { portfolioId: true } },
                },
            }),
            prisma.workItem.findMany({
                where: {
                    projectId: { in: projectIds }, deletedAt: null, status: { notIn: ['DONE', 'CLOSED'] },
                    sprint: { is: { endDate: { lt: seenAt }, status: { not: 'CLOSED' } } },
                },
                select: { id: true, key: true, title: true, description: true, projectId: true, assigneeId: true, sprint: { select: { id: true, name: true, endDate: true } } },
            }),
        ]);

        const generated: GeneratedAction[] = [];
        for (const bug of bugs) generated.push({
            projectId: bug.projectId,
            assigneeId: bug.assigneeId,
            sourceType: 'WORK_ITEM', sourceId: bug.id, actionType: 'FIX_CRITICAL_BUG', dedupeKey: `critical-bug:${bug.id}`,
            title: 'action_center.generated.FIX_CRITICAL_BUG.title',
            description: bug.description || 'action_center.generated.FIX_CRITICAL_BUG.description',
            severity: 'CRITICAL', dueDate: null, actionUrl: `/b/${encodeURIComponent(bug.key)}`,
            metadata: { workItemKey: bug.key, workItemTitle: bug.title, detectedAssigneeId: bug.assigneeId || null, detectedUpdatedAt: bug.updatedAt.toISOString(), systemManaged: true },
        });

        const readinessThresholds: Record<string, number> = { TIER_0: 95, TIER_1: 90, TIER_2: 82, TIER_3: 70 };
        for (const release of releases) {
            const threshold = readinessThresholds[release.project.qualityTier] ?? 82;
            const failures = release.failedRunItems + release.blockedRunItems + release.conflictRunItems;
            const reasons: string[] = [];
            if (release.criticalOpenBugs > 0) reasons.push(`${release.criticalOpenBugs} kritik hata açık`);
            if (failures > 0) reasons.push(`${failures} başarısız, bloklu veya çakışmalı test`);
            if (release.openRuns > 0) reasons.push(`${release.openRuns} test koşumu tamamlanmadı`);
            if (release.traceabilityGaps > 0) reasons.push(`${release.traceabilityGaps} izlenebilirlik boşluğu`);
            if (release.readinessScore !== null && release.readinessScore < threshold) reasons.push(`hazırlık skoru ${release.readinessScore.toFixed(1)}; tier eşiği ${threshold}`);
            if (!reasons.length) continue;
            generated.push({
                projectId: release.projectId,
                assigneeId: null,
                sourceType: 'RELEASE_CANDIDATE', sourceId: release.id, actionType: 'REMEDIATE_RELEASE_BLOCKER', dedupeKey: `release-readiness:${release.id}`,
                title: 'action_center.generated.REMEDIATE_RELEASE_BLOCKER.title',
                description: 'action_center.generated.REMEDIATE_RELEASE_BLOCKER.description', severity: release.criticalOpenBugs > 0 ? 'CRITICAL' : 'HIGH', dueDate: null,
                actionUrl: `/b/${encodeURIComponent(release.key)}`,
                metadata: { releaseKey: release.key, releaseTitle: release.title, qualityTier: release.project.qualityTier, readinessScore: release.readinessScore, readinessThreshold: threshold, criticalOpenBugs: release.criticalOpenBugs, failedOrBlockedTests: failures, openRuns: release.openRuns, traceabilityGaps: release.traceabilityGaps, reasons, systemManaged: true },
            });
        }

        for (const initiative of initiatives) {
            const overdue = Boolean(initiative.targetDate && initiative.targetDate < seenAt);
            generated.push({
                projectId: initiative.projectId,
                assigneeId: initiative.ownerId,
                sourceType: 'PORTFOLIO_INITIATIVE', sourceId: initiative.id, actionType: 'MITIGATE_INITIATIVE_RISK', dedupeKey: `initiative-risk:${initiative.id}`,
                title: 'action_center.generated.MITIGATE_INITIATIVE_RISK.title',
                description: initiative.description || 'action_center.generated.MITIGATE_INITIATIVE_RISK.description',
                severity: initiative.status === 'BLOCKED' || initiative.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                dueDate: initiative.targetDate,
                actionUrl: `/portfolio?portfolio=${encodeURIComponent(initiative.program.portfolioId)}&initiative=${encodeURIComponent(initiative.id)}`,
                metadata: { portfolioId: initiative.program.portfolioId, initiativeTitle: initiative.title, initiativeStatus: initiative.status, initiativePriority: initiative.priority, ownerId: initiative.ownerId || null, overdue, systemManaged: true },
            });
        }

        for (const item of overdueItems) generated.push({
            projectId: item.projectId,
            assigneeId: item.assigneeId,
            sourceType: 'WORK_ITEM', sourceId: item.id, actionType: 'COMPLETE_OVERDUE_WORK', dedupeKey: `overdue-work-item:${item.id}`,
            title: 'action_center.generated.COMPLETE_OVERDUE_WORK.title',
            description: 'action_center.generated.COMPLETE_OVERDUE_WORK.description',
            severity: 'HIGH', dueDate: item.sprint?.endDate || null, actionUrl: `/b/${encodeURIComponent(item.key)}`,
            metadata: { workItemKey: item.key, workItemTitle: item.title, sprintId: item.sprint?.id || null, sprintName: item.sprint?.name || null, detectedAssigneeId: item.assigneeId || null, systemManaged: true },
        });

        const keys = generated.map((action) => action.dedupeKey);
        const existingKeys = keys.length
            ? new Set((await prisma.actionCenterItem.findMany({
                where: { organizationId: actor.organizationId, dedupeKey: { in: keys } },
                select: { dedupeKey: true },
            })).map((item) => item.dedupeKey))
            : new Set<string>();
        for (let offset = 0; offset < generated.length; offset += 100) {
            const batch = generated.slice(offset, offset + 100);
            await prisma.$transaction(batch.map((action) => prisma.actionCenterItem.upsert({
                where: { organizationId_dedupeKey: { organizationId: actor.organizationId, dedupeKey: action.dedupeKey } },
                create: {
                    organizationId: actor.organizationId,
                    projectId: action.projectId,
                    assigneeId: action.assigneeId,
                    sourceType: action.sourceType,
                    sourceId: action.sourceId,
                    actionType: action.actionType,
                    dedupeKey: action.dedupeKey,
                    title: action.title,
                    description: action.description,
                    severity: action.severity,
                    dueDate: action.dueDate,
                    actionUrl: action.actionUrl,
                    metadata: action.metadata,
                    lastSeenAt: seenAt,
                },
                update: {
                    projectId: action.projectId,
                    title: action.title,
                    description: action.description,
                    severity: action.severity,
                    dueDate: action.dueDate,
                    actionUrl: action.actionUrl,
                    metadata: action.metadata,
                    lastSeenAt: seenAt,
                },
            })));
        }

        const reopened = keys.length ? await prisma.actionCenterItem.updateMany({
            where: {
                organizationId: actor.organizationId,
                dedupeKey: { in: keys },
                status: 'RESOLVED',
                resolution: autoResolution,
            },
            data: { status: 'OPEN', resolution: null, resolvedAt: null, resolvedById: null, snoozedUntil: null },
        }) : { count: 0 };
        const autoResolveScope: Prisma.ActionCenterItemWhereInput = this.isAdmin(actor) ? {} : { projectId: { in: projectIds } };
        const resolved = await prisma.actionCenterItem.updateMany({
            where: {
                organizationId: actor.organizationId,
                actionType: { in: [...systemActionTypes] },
                status: { in: activeStatuses },
                lastSeenAt: { lt: seenAt },
                ...autoResolveScope,
            },
            data: { status: 'RESOLVED', resolution: autoResolution, resolvedAt: seenAt, resolvedById: null, snoozedUntil: null },
        });
        return {
            ...await this.summary(actor),
            reconciliation: { detected: generated.length, created: keys.filter((key) => !existingKeys.has(key)).length, autoResolved: resolved.count, reopened: reopened.count, generatedAt: seenAt },
        };
    }

    private async accessibleItems(actor: ActionCenterActor, ids: string[]) {
        const projectIds = await this.accessibleProjectIds(actor);
        const items = await prisma.actionCenterItem.findMany({
            where: {
                organizationId: actor.organizationId,
                id: { in: ids },
                AND: [this.visibilityWhere(actor, projectIds)],
            },
            include: itemInclude,
        });
        if (items.length !== ids.length) throw new AppError('Aksiyon bulunamadı veya erişim yetkiniz yok.', 404);
        return items;
    }

    private async assertAssignee(actor: ActionCenterActor, assigneeId: string, projectIds: string[]) {
        const user = await prisma.user.findFirst({
            where: {
                id: assigneeId, isActive: true, deletedAt: null,
                organizationMemberships: { some: { organizationId: actor.organizationId } },
            },
            select: { id: true },
        });
        if (!user) throw new AppError('Atanan kullanıcı bu kurumun aktif bir üyesi değil.', 400);
        if (projectIds.length) {
            const membershipCount = await prisma.projectMember.count({ where: { userId: assigneeId, projectId: { in: projectIds } } });
            if (membershipCount !== projectIds.length) throw new AppError('Atanan kullanıcı seçili aksiyonların tüm projelerine üye olmalıdır.', 400);
        }
    }

    private async mutationData(actor: ActionCenterActor, items: Array<{ assigneeId: string | null; projectId: string | null; status: ActionItemStatus; resolution: string | null }>, input: MutationInput): Promise<Prisma.ActionCenterItemUncheckedUpdateManyInput> {
        const mutableKeys = ['status', 'assigneeId', 'dueDate', 'snoozedUntil', 'resolution'];
        if (!mutableKeys.some((key) => has(input, key))) throw new AppError('Güncellenecek en az bir aksiyon alanı gönderilmelidir.', 400);
        const manager = this.isManager(actor);
        if (!manager && items.some((item) => item.assigneeId && item.assigneeId !== actor.userId)) {
            throw new AppError('Başka bir ekip üyesine atanmış aksiyonu güncelleyemezsiniz.', 403);
        }
        const data: Prisma.ActionCenterItemUncheckedUpdateManyInput = {};
        let nextAssigneeIds = items.map((item) => item.assigneeId);
        if (has(input, 'assigneeId')) {
            if (input.assigneeId !== null && (typeof input.assigneeId !== 'string' || !input.assigneeId.trim())) throw new AppError('Geçersiz atanan kullanıcı.', 400);
            const assigneeId = typeof input.assigneeId === 'string' ? input.assigneeId.trim() : null;
            if (!manager && assigneeId !== actor.userId && !(assigneeId === null && items.every((item) => item.assigneeId === actor.userId || item.assigneeId === null))) {
                throw new AppError('Aksiyonu yalnızca kendinize atayabilir veya kendi atamanızı kaldırabilirsiniz.', 403);
            }
            if (assigneeId) await this.assertAssignee(actor, assigneeId, [...new Set(items.map((item) => item.projectId).filter((id): id is string => Boolean(id)))]);
            data.assigneeId = assigneeId;
            nextAssigneeIds = items.map(() => assigneeId);
        }

        const nextStatus = has(input, 'status') && typeof input.status === 'string' ? input.status.toUpperCase() as ActionItemStatus : undefined;
        if (has(input, 'status') && (!nextStatus || !actionStatuses.has(nextStatus))) throw new AppError('Geçersiz aksiyon durumu.', 400);
        if (nextStatus === 'DISMISSED' && !manager) throw new AppError('Aksiyonu kapsam dışı bırakmak için yönetici yetkisi gereklidir.', 403);
        if (!manager && nextStatus && ['RESOLVED', 'DISMISSED'].includes(nextStatus) && nextAssigneeIds.some((id) => id !== actor.userId)) {
            throw new AppError('Çözümlemeden önce aksiyon size atanmalıdır.', 403);
        }

        const resolutionInput = has(input, 'resolution')
            ? (input.resolution === null ? null : asTrimmedString(input.resolution, 2000))
            : undefined;
        if (has(input, 'resolution') && input.resolution !== null && !resolutionInput) throw new AppError('Çözüm açıklaması boş olamaz.', 400);
        if (nextStatus && ['RESOLVED', 'DISMISSED'].includes(nextStatus)) {
            const fallbackResolution = items.length === 1 ? items[0].resolution : null;
            const resolution = resolutionInput === undefined ? fallbackResolution : resolutionInput;
            if (!resolution) throw new AppError('Çözümlenen veya kapsam dışı bırakılan aksiyon için gerekçe zorunludur.', 400);
            data.status = nextStatus;
            data.resolution = resolution;
            data.resolvedAt = new Date();
            data.resolvedById = actor.userId;
            data.snoozedUntil = null;
        } else if (nextStatus) {
            data.status = nextStatus;
            data.resolution = null;
            data.resolvedAt = null;
            data.resolvedById = null;
        } else if (resolutionInput !== undefined) {
            if (items.some((item) => !['RESOLVED', 'DISMISSED'].includes(item.status))) throw new AppError('Çözüm açıklaması yalnızca tamamlanmış aksiyonlarda değiştirilebilir.', 400);
            if (!resolutionInput) throw new AppError('Tamamlanmış aksiyonun çözüm gerekçesi kaldırılamaz.', 400);
            data.resolution = resolutionInput;
        }

        if (has(input, 'dueDate')) data.dueDate = parseDate(input.dueDate, 'Bitiş tarihi');
        if (has(input, 'snoozedUntil')) {
            const snoozedUntil = parseDate(input.snoozedUntil, 'Erteleme tarihi');
            if (snoozedUntil && snoozedUntil <= new Date()) throw new AppError('Erteleme tarihi gelecekte olmalıdır.', 400);
            if (snoozedUntil && snoozedUntil.getTime() > Date.now() + 366 * oneDay) throw new AppError('Bir aksiyon en fazla bir yıl ertelenebilir.', 400);
            if (snoozedUntil && !nextStatus && items.some((item) => ['RESOLVED', 'DISMISSED'].includes(item.status))) throw new AppError('Tamamlanmış aksiyon ertelenemez; önce yeniden açılmalıdır.', 409);
            if (!manager && snoozedUntil && nextAssigneeIds.some((id) => id !== actor.userId)) throw new AppError('Ertelemeden önce aksiyon size atanmalıdır.', 403);
            data.snoozedUntil = snoozedUntil;
        }
        return data;
    }

    async update(actor: ActionCenterActor, id: string, input: MutationInput) {
        const [before] = await this.accessibleItems(actor, [id]);
        const data = await this.mutationData(actor, [before], input);
        const item = await prisma.actionCenterItem.update({ where: { id }, data, include: itemInclude });
        return { before, item };
    }

    async bulkUpdate(actor: ActionCenterActor, input: MutationInput & { ids?: unknown }) {
        if (!Array.isArray(input.ids)) throw new AppError('Aksiyon kimlikleri liste olarak gönderilmelidir.', 400);
        if (input.ids.some((id) => typeof id !== 'string' || !id.trim())) throw new AppError('Tüm aksiyon kimlikleri geçerli olmalıdır.', 400);
        const ids = [...new Set((input.ids as string[]).map((id) => id.trim()))];
        if (!ids.length || ids.length > 100) throw new AppError('Toplu işlem için 1 ile 100 arasında aksiyon seçilmelidir.', 400);
        const before = await this.accessibleItems(actor, ids);
        const data = await this.mutationData(actor, before, input);
        const result = await prisma.actionCenterItem.updateMany({
            where: { id: { in: ids }, organizationId: actor.organizationId },
            data,
        });
        return { updated: result.count, ids, before };
    }

    private async serializable<T>(operation: () => Promise<T>) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try { return await operation(); }
            catch (error) {
                const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
                if (!retryable || attempt === 3) throw error;
            }
        }
        throw new AppError('İşlem tamamlanamadı.', 409);
    }

    async convertToWorkItem(actor: ActionCenterActor, id: string, input: ConversionInput = {}) {
        const [accessible] = await this.accessibleItems(actor, [id]);
        if (!this.isManager(actor) && accessible.assigneeId && accessible.assigneeId !== actor.userId) throw new AppError('Başka bir ekip üyesine atanmış aksiyonu işe dönüştüremezsiniz.', 403);
        if (['RESOLVED', 'DISMISSED'].includes(accessible.status)) throw new AppError('Tamamlanmış aksiyonu işe dönüştürmeden önce yeniden açın.', 409);
        const requestedProjectId = asTrimmedString(input.projectId, 80);
        const projectId = accessible.projectId || requestedProjectId;
        if (!projectId) throw new AppError('Bu aksiyonu işe dönüştürmek için hedef proje seçilmelidir.', 400);
        if (accessible.projectId && requestedProjectId && accessible.projectId !== requestedProjectId) throw new AppError('Proje kapsamındaki aksiyon farklı bir projeye taşınamaz.', 400);
        const project = await this.assertProjectAccess(actor, projectId);
        if (project.status !== 'ACTIVE') throw new AppError('Arşivlenmiş projede iş oluşturulamaz.', 409);

        const allowedTypes = new Set<WorkItemType>(['TASK', 'BUG', 'DEFECT', 'OPERATIONAL', 'SUPPORT']);
        const itemType = (asTrimmedString(input.itemType, 30).toUpperCase() || 'OPERATIONAL') as WorkItemType;
        if (!allowedTypes.has(itemType)) throw new AppError('Bu aksiyon için desteklenmeyen iş türü.', 400);
        const priorities = new Set<Priority>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
        const requestedPriority = asTrimmedString(input.priority, 20).toUpperCase() as Priority;
        const priority = priorities.has(requestedPriority) ? requestedPriority : accessible.severity as Priority;
        const requestedAssigneeId = has(input, 'assigneeId')
            ? (input.assigneeId === null ? null : asTrimmedString(input.assigneeId, 80))
            : (accessible.assigneeId || (this.isAdmin(actor) ? null : actor.userId));
        if (has(input, 'assigneeId') && input.assigneeId !== null && !requestedAssigneeId) throw new AppError('Geçersiz atanan kullanıcı.', 400);
        if (requestedAssigneeId) await this.assertAssignee(actor, requestedAssigneeId, [projectId]);
        const requirementId = asTrimmedString(input.requirementId, 80) || null;
        if (itemType === 'TASK' && !requirementId) throw new AppError('Geliştirme işleri için requirementId zorunludur.', 400);
        if (requirementId && !await prisma.requirement.findFirst({ where: { id: requirementId, projectId, deletedAt: null }, select: { id: true } })) {
            throw new AppError('Requirement hedef projede bulunamadı.', 400);
        }
        const bugSeverities = new Set<BugSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
        const requestedSeverity = asTrimmedString(input.severity, 20).toUpperCase() as BugSeverity;
        const severity = ['BUG', 'DEFECT'].includes(itemType)
            ? (bugSeverities.has(requestedSeverity) ? requestedSeverity : accessible.severity as BugSeverity)
            : null;
        const stepsToReproduce = asTrimmedString(input.stepsToReproduce, 10_000) || null;
        if (itemType === 'BUG' && !stepsToReproduce) throw new AppError('BUG işleri için yeniden oluşturma adımları zorunludur.', 400);

        return this.serializable(() => prisma.$transaction(async (tx) => {
            const action = await tx.actionCenterItem.findFirst({ where: { id, organizationId: actor.organizationId } });
            if (!action) throw new AppError('Aksiyon bulunamadı.', 404);
            const activeProject = await tx.project.findFirst({ where: { id: projectId, organizationId: actor.organizationId, status: 'ACTIVE' }, select: { id: true } });
            if (!activeProject) throw new AppError('Hedef proje bulunamadı veya artık aktif değil.', 409);
            if (!this.isAdmin(actor) && !await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: actor.userId } }, select: { id: true } })) {
                throw new AppError('Hedef projeye erişim yetkiniz artık bulunmuyor.', 403);
            }
            if (requestedAssigneeId && !await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: requestedAssigneeId } }, select: { id: true } })) {
                throw new AppError('Atanan kullanıcı artık hedef projenin üyesi değil.', 409);
            }
            const currentMetadata = metadataObject(action.metadata);
            const linkedId = typeof currentMetadata.workItemId === 'string' ? currentMetadata.workItemId : null;
            if (linkedId) {
                const linked = await tx.workItem.findFirst({
                    where: { id: linkedId, deletedAt: null, project: { organizationId: actor.organizationId } },
                    select: { id: true, key: true, projectId: true },
                });
                if (linked) return { ...linked, url: `/b/${encodeURIComponent(linked.key)}`, created: false };
            }

            if (action.sourceType === 'WORK_ITEM') {
                const source = await tx.workItem.findFirst({
                    where: { id: action.sourceId, projectId, deletedAt: null, project: { organizationId: actor.organizationId } },
                    select: { id: true, key: true, assigneeId: true },
                });
                if (source) {
                    await tx.actionCenterItem.update({ where: { id }, data: {
                        status: 'IN_PROGRESS', assigneeId: action.assigneeId || source.assigneeId || (this.isAdmin(actor) ? null : actor.userId),
                        actionUrl: `/b/${encodeURIComponent(source.key)}`,
                        metadata: { ...currentMetadata, workItemId: source.id, convertedAt: new Date().toISOString(), convertedById: actor.userId },
                        resolution: null, resolvedAt: null, resolvedById: null,
                    } });
                    return { ...source, projectId, url: `/b/${encodeURIComponent(source.key)}`, created: false };
                }
            }

            const firstColumn = await tx.boardColumn.findFirst({
                where: { projectId }, orderBy: { orderIndex: 'asc' },
                select: { id: true, mappedStatus: true },
            });
            const incremented = await tx.project.update({
                where: { id: projectId },
                data: { nextWorkItemNumber: { increment: 1 } },
                select: { key: true, nextWorkItemNumber: true },
            });
            const maximum = await tx.workItem.aggregate({ where: { projectId }, _max: { sequenceNumber: true } });
            const sequenceNumber = Math.max(incremented.nextWorkItemNumber - 1, (maximum._max.sequenceNumber ?? 0) + 1);
            if (sequenceNumber >= incremented.nextWorkItemNumber) {
                await tx.project.update({ where: { id: projectId }, data: { nextWorkItemNumber: sequenceNumber + 1 } });
            }
            const initiativeId = action.sourceType === 'PORTFOLIO_INITIATIVE'
                && await tx.portfolioInitiative.findFirst({ where: { id: action.sourceId, projectId }, select: { id: true } })
                ? action.sourceId : null;
            const title = asTrimmedString(input.title, 300) || action.title;
            const suppliedDescription = asTrimmedString(input.description, 20_000);
            const description = suppliedDescription || [action.description, `Aksiyon merkezi kaydı: ${action.id}`].filter(Boolean).join('\n\n');
            const workItem = await tx.workItem.create({
                data: {
                    key: `${incremented.key}-${sequenceNumber}`,
                    sequenceNumber,
                    projectId,
                    itemType,
                    title,
                    description,
                    priority,
                    status: firstColumn?.mappedStatus || 'TODO',
                    boardColumnId: firstColumn?.id || null,
                    assigneeId: requestedAssigneeId,
                    reporterId: actor.userId,
                    requirementId,
                    severity,
                    stepsToReproduce,
                    initiativeId,
                },
                select: { id: true, key: true },
            });
            await tx.actionCenterItem.update({ where: { id }, data: {
                status: 'IN_PROGRESS', assigneeId: action.assigneeId || requestedAssigneeId || null,
                actionUrl: `/b/${encodeURIComponent(workItem.key)}`,
                metadata: { ...currentMetadata, workItemId: workItem.id, convertedAt: new Date().toISOString(), convertedById: actor.userId },
                resolution: null, resolvedAt: null, resolvedById: null,
            } });
            return { ...workItem, projectId, url: `/b/${encodeURIComponent(workItem.key)}`, created: true };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    }
}

export const actionCenterService = new ActionCenterService();
