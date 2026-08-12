import { DashboardScope, DashboardWidgetType, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { createLogger } from '../utils/logger';

type Actor = { userId: string; role: string; organizationId: string };
type WidgetInput = { id?: unknown; type?: unknown; title?: unknown; positionX?: unknown; positionY?: unknown; width?: unknown; height?: unknown; config?: unknown };
type DashboardCreateInput = { name?: unknown; description?: unknown; scope?: unknown; projectId?: unknown; cloneFromId?: unknown };
type DashboardUpdateInput = { name?: unknown; description?: unknown; scope?: unknown; projectId?: unknown };

const logger = createLogger('DashboardStudio');

export const DASHBOARD_WIDGET_CATALOG = [
    { type: 'KPI_WORK_ITEMS', defaultTitle: 'Açık işler', minWidth: 2, minHeight: 2, category: 'WORK' },
    { type: 'KPI_CRITICAL_BUGS', defaultTitle: 'Kritik buglar', minWidth: 2, minHeight: 2, category: 'QUALITY' },
    { type: 'KPI_PASS_RATE', defaultTitle: 'Pass oranı', minWidth: 2, minHeight: 2, category: 'QUALITY' },
    { type: 'KPI_RELEASE_READINESS', defaultTitle: 'Release hazırlığı', minWidth: 2, minHeight: 2, category: 'RELEASE' },
    { type: 'STATUS_DISTRIBUTION', defaultTitle: 'Durum dağılımı', minWidth: 4, minHeight: 3, category: 'WORK' },
    { type: 'EXECUTION_TREND', defaultTitle: 'Test sonucu trendi', minWidth: 5, minHeight: 3, category: 'QUALITY' },
    { type: 'MY_WORK', defaultTitle: 'İş kuyruğum', minWidth: 4, minHeight: 3, category: 'PERSONAL' },
    { type: 'RISK_ACTIONS', defaultTitle: 'Risk aksiyonları', minWidth: 4, minHeight: 3, category: 'RISK' },
    { type: 'PORTFOLIO_HEALTH', defaultTitle: 'Portföy sağlığı', minWidth: 4, minHeight: 3, category: 'PORTFOLIO' },
] as const;

const catalogByType = new Map(DASHBOARD_WIDGET_CATALOG.map((item) => [item.type, item]));
const dashboardScopes = new Set<DashboardScope>(['PERSONAL', 'PROJECT', 'ORGANIZATION']);
const clamp = (value: unknown, min: number, max: number, fallback: number) => Math.min(max, Math.max(min, typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const optionalId = (value: unknown, field: string): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new AppError(`${field} geçersiz.`, 400);
    return value.trim();
};

const requiredText = (value: unknown, field: string, maxLength: number): string => {
    if (typeof value !== 'string' || !value.trim()) throw new AppError(`${field} zorunludur.`, 400);
    return value.trim().slice(0, maxLength);
};

const optionalText = (value: unknown, field: string, maxLength: number): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') throw new AppError(`${field} metin olmalıdır.`, 400);
    return value.trim().slice(0, maxLength) || null;
};

export class DashboardStudioService {
    private isAdmin(actor: Actor) { return actor.role.toUpperCase() === 'ADMIN'; }
    private isManager(actor: Actor) { return ['ADMIN', 'TEAM_LEADER'].includes(actor.role.toUpperCase()); }

    private async accessibleProjectIds(actor: Actor) {
        if (this.isAdmin(actor)) return (await prisma.project.findMany({ where: { organizationId: actor.organizationId }, select: { id: true } })).map((item) => item.id);
        return (await prisma.projectMember.findMany({ where: { userId: actor.userId, project: { organizationId: actor.organizationId } }, select: { projectId: true } })).map((item) => item.projectId);
    }

    private visibilityWhere(actor: Actor, projectIds: string[], write = false): Prisma.DashboardDefinitionWhereInput {
        const personal: Prisma.DashboardDefinitionWhereInput = { scope: 'PERSONAL', ownerId: actor.userId };
        const project: Prisma.DashboardDefinitionWhereInput = { scope: 'PROJECT', projectId: { in: projectIds } };
        if (!write) return { OR: [personal, { scope: 'ORGANIZATION' }, project] };
        if (this.isAdmin(actor)) return { OR: [personal, { scope: 'ORGANIZATION' }, project] };
        if (this.isManager(actor)) return { OR: [personal, project] };
        return personal;
    }

    private accessWhere(actor: Actor, projectIds: string[], write = false): Prisma.DashboardDefinitionWhereInput {
        return {
            organizationId: actor.organizationId,
            deletedAt: null,
            AND: [this.visibilityWhere(actor, projectIds, write)],
        };
    }

    private async getAccessible(id: string, actor: Actor, write = false, knownProjectIds?: string[]) {
        const dashboardId = optionalId(id, 'Dashboard kimliği');
        if (!dashboardId) throw new AppError('Dashboard kimliği zorunludur.', 400);
        const projectIds = knownProjectIds || await this.accessibleProjectIds(actor);
        const dashboard = await prisma.dashboardDefinition.findFirst({ where: {
            id: dashboardId,
            ...this.accessWhere(actor, projectIds, write),
        }, include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] }, owner: { select: { id: true, firstName: true, lastName: true } } } });
        if (!dashboard) throw new AppError('Dashboard bulunamadı veya erişim yetkiniz yok.', 404);
        return dashboard;
    }

    async catalog() { return DASHBOARD_WIDGET_CATALOG; }

    async list(actor: Actor) {
        const projectIds = await this.accessibleProjectIds(actor);
        const where: Prisma.DashboardDefinitionWhereInput = {
            ...this.accessWhere(actor, projectIds),
        };
        const [dashboards, preference] = await Promise.all([
            prisma.dashboardDefinition.findMany({ where, orderBy: [{ updatedAt: 'desc' }], include: { _count: { select: { widgets: true } }, owner: { select: { id: true, firstName: true, lastName: true } }, project: { select: { id: true, key: true, name: true } } } }),
            prisma.dashboardPreference.findUnique({ where: { userId_organizationId: { userId: actor.userId, organizationId: actor.organizationId } }, select: { dashboardId: true } }),
        ]);
        const preferredId = dashboards.some((dashboard) => dashboard.id === preference?.dashboardId)
            ? preference?.dashboardId
            : undefined;
        return dashboards
            .map((dashboard) => ({ ...dashboard, isDefault: dashboard.id === preferredId }))
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    }

    async ensureDefault(actor: Actor, knownProjectIds?: string[]) {
        const projectIds = knownProjectIds || await this.accessibleProjectIds(actor);
        const preference = await prisma.dashboardPreference.findFirst({
            where: {
                userId: actor.userId,
                organizationId: actor.organizationId,
                dashboard: { is: this.accessWhere(actor, projectIds) },
            },
            include: { dashboard: { include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } } } },
        });
        if (preference) return { ...preference.dashboard, isDefault: true, wasCreated: false };
        const existing = await prisma.dashboardDefinition.findFirst({ where: { ownerId: actor.userId, organizationId: actor.organizationId, scope: 'PERSONAL', deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], include: { widgets: true } });
        if (existing) {
            await prisma.dashboardPreference.upsert({
                where: { userId_organizationId: { userId: actor.userId, organizationId: actor.organizationId } },
                create: { userId: actor.userId, organizationId: actor.organizationId, dashboardId: existing.id },
                update: { dashboardId: existing.id },
            });
            return { ...existing, isDefault: true, wasCreated: false };
        }
        try {
            return await prisma.$transaction(async (tx) => {
                const created = await tx.dashboardDefinition.create({ data: {
                    organizationId: actor.organizationId, ownerId: actor.userId, name: 'Nexa Home', scope: 'PERSONAL', isDefault: true,
                    widgets: { create: [
                        { type: 'MY_WORK', title: 'MY_WORK', positionX: 0, positionY: 0, width: 6, height: 3, config: { defaultTitle: true } },
                        { type: 'RISK_ACTIONS', title: 'RISK_ACTIONS', positionX: 6, positionY: 0, width: 6, height: 3, config: { defaultTitle: true } },
                        { type: 'KPI_WORK_ITEMS', title: 'KPI_WORK_ITEMS', positionX: 0, positionY: 3, width: 3, height: 2, config: { defaultTitle: true } },
                        { type: 'KPI_CRITICAL_BUGS', title: 'KPI_CRITICAL_BUGS', positionX: 3, positionY: 3, width: 3, height: 2, config: { defaultTitle: true } },
                        { type: 'KPI_PASS_RATE', title: 'KPI_PASS_RATE', positionX: 6, positionY: 3, width: 3, height: 2, config: { defaultTitle: true } },
                        { type: 'KPI_RELEASE_READINESS', title: 'KPI_RELEASE_READINESS', positionX: 9, positionY: 3, width: 3, height: 2, config: { defaultTitle: true } },
                    ] },
                }, include: { widgets: true } });
                await tx.dashboardPreference.upsert({
                    where: { userId_organizationId: { userId: actor.userId, organizationId: actor.organizationId } },
                    create: { userId: actor.userId, organizationId: actor.organizationId, dashboardId: created.id },
                    update: { dashboardId: created.id },
                });
                return { ...created, isDefault: true, wasCreated: true };
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const concurrent = await prisma.dashboardDefinition.findFirstOrThrow({ where: { ownerId: actor.userId, organizationId: actor.organizationId, scope: 'PERSONAL', deletedAt: null }, include: { widgets: true } });
                await prisma.dashboardPreference.upsert({
                    where: { userId_organizationId: { userId: actor.userId, organizationId: actor.organizationId } },
                    create: { userId: actor.userId, organizationId: actor.organizationId, dashboardId: concurrent.id },
                    update: { dashboardId: concurrent.id },
                });
                return { ...concurrent, isDefault: true, wasCreated: false };
            }
            throw error;
        }
    }

    async create(actor: Actor, input: DashboardCreateInput) {
        const name = requiredText(input.name, 'Dashboard adı', 100);
        const description = optionalText(input.description, 'Dashboard açıklaması', 500);
        const requestedScope = input.scope === undefined ? 'PERSONAL' : input.scope;
        if (typeof requestedScope !== 'string' || !dashboardScopes.has(requestedScope as DashboardScope)) throw new AppError('Geçersiz dashboard kapsamı.', 400);
        const scope = requestedScope as DashboardScope;
        if (scope === 'ORGANIZATION' && !this.isAdmin(actor)) throw new AppError('Kurum dashboardu oluşturmak için kurum yöneticisi yetkisi gerekir.', 403);
        if (scope === 'PROJECT' && !this.isManager(actor)) throw new AppError('Proje dashboardu oluşturmak için yönetici yetkisi gerekir.', 403);
        const projectId = optionalId(input.projectId, 'Proje kimliği');
        const cloneFromId = optionalId(input.cloneFromId, 'Kaynak dashboard kimliği');
        const projectIds = await this.accessibleProjectIds(actor);
        if (scope === 'PROJECT') {
            if (!projectId || !projectIds.includes(projectId)) throw new AppError('Geçerli ve erişilebilir bir proje seçilmelidir.', 400);
        }
        const clone = cloneFromId ? await this.getAccessible(cloneFromId, actor, false, projectIds) : null;
        if (clone && clone.widgets.length > 30) throw new AppError('30 widget sınırını aşan dashboard klonlanamaz.', 409);
        return prisma.dashboardDefinition.create({ data: {
            organizationId: actor.organizationId, ownerId: actor.userId, name, description, scope,
            projectId: scope === 'PROJECT' ? projectId : null, filters: clone?.filters ?? undefined,
            widgets: clone ? { create: clone.widgets.map((widget) => ({ type: widget.type, title: widget.title, positionX: widget.positionX, positionY: widget.positionY, width: widget.width, height: widget.height, config: widget.config === null ? undefined : widget.config as Prisma.InputJsonValue })) } : undefined,
        }, include: { widgets: true } });
    }

    async updateDefinition(actor: Actor, id: string, input: DashboardUpdateInput) {
        const projectIds = await this.accessibleProjectIds(actor);
        const dashboard = await this.getAccessible(id, actor, true, projectIds);
        if (input.scope !== undefined && (typeof input.scope !== 'string' || !dashboardScopes.has(input.scope as DashboardScope))) throw new AppError('Geçersiz dashboard kapsamı.', 400);
        const scope = (input.scope ?? dashboard.scope) as DashboardScope;
        if (scope === 'ORGANIZATION' && !this.isAdmin(actor)) throw new AppError('Kurum dashboardunu düzenlemek için kurum yöneticisi yetkisi gerekir.', 403);
        if (scope === 'PROJECT' && !this.isManager(actor)) throw new AppError('Proje dashboardunu düzenlemek için yönetici yetkisi gerekir.', 403);
        if (scope === 'PERSONAL' && dashboard.ownerId !== actor.userId) throw new AppError('Paylaşılan dashboard kişisel kapsama dönüştürülemez.', 403);
        const requestedProjectId = optionalId(input.projectId, 'Proje kimliği');
        const projectId = requestedProjectId ?? dashboard.projectId;
        if (scope === 'PROJECT') {
            if (!projectId || !projectIds.includes(projectId)) throw new AppError('Geçerli ve erişilebilir bir proje seçilmelidir.', 400);
        }
        const name = input.name === undefined ? dashboard.name : requiredText(input.name, 'Dashboard adı', 100);
        const description = optionalText(input.description, 'Dashboard açıklaması', 500);
        return prisma.dashboardDefinition.update({
            where: { id: dashboard.id },
            data: {
                name,
                description: description === undefined ? dashboard.description : description,
                scope,
                projectId: scope === 'PROJECT' ? projectId : null,
            },
            include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
        });
    }

    async saveLayout(actor: Actor, id: string, widgets: unknown, expectedLayoutVersion?: unknown) {
        const projectIds = await this.accessibleProjectIds(actor);
        const dashboard = await this.getAccessible(id, actor, true, projectIds);
        if (!Array.isArray(widgets) || widgets.length > 30) throw new AppError('Bir dashboard 0 ile 30 arasında widget içerebilir.', 400);
        if (!Number.isInteger(expectedLayoutVersion) || Number(expectedLayoutVersion) < 1) {
            throw new AppError('Güncel layoutVersion ile kaydetmeniz gerekir.', 400);
        }
        const existingWidgetIds = new Set(dashboard.widgets.map((widget) => widget.id));
        const submittedWidgetIds = new Set<string>();
        const normalized = widgets.map((rawWidget: unknown, index) => {
            if (!isRecord(rawWidget)) throw new AppError('Widget tanımı geçersiz.', 400);
            const widget = rawWidget as WidgetInput;
            if (typeof widget.type !== 'string') throw new AppError('Widget türü zorunludur.', 400);
            const type = widget.type as DashboardWidgetType;
            const definition = catalogByType.get(type as typeof DASHBOARD_WIDGET_CATALOG[number]['type']);
            if (!definition) throw new AppError(`Desteklenmeyen widget türü: ${widget.type}`, 400);
            const suppliedWidgetId = optionalId(widget.id, 'Widget kimliği');
            if (suppliedWidgetId && submittedWidgetIds.has(suppliedWidgetId)) throw new AppError('Aynı widget birden fazla kez gönderilemez.', 400);
            if (suppliedWidgetId) submittedWidgetIds.add(suppliedWidgetId);
            const widgetId = suppliedWidgetId?.startsWith('draft-') ? undefined : suppliedWidgetId;
            if (widgetId && !existingWidgetIds.has(widgetId)) throw new AppError('Widget bu dashboarda ait değil.', 400);
            if (widget.title !== undefined && typeof widget.title !== 'string') throw new AppError('Widget başlığı metin olmalıdır.', 400);
            if (widget.config !== undefined && !isRecord(widget.config)) throw new AppError('Widget ayarları geçerli bir nesne olmalıdır.', 400);
            const config = (widget.config || {}) as Record<string, unknown>;
            const serializedConfig = JSON.stringify(config);
            if (serializedConfig.length > 16_384) throw new AppError('Widget ayarları 16 KB sınırını aşamaz.', 400);
            const configuredProjectId = optionalId(config.projectId, 'Widget proje kimliği');
            if (configuredProjectId && !projectIds.includes(configuredProjectId)) throw new AppError('Widget için seçilen projeye erişim yetkiniz yok.', 403);
            if (dashboard.projectId && configuredProjectId && configuredProjectId !== dashboard.projectId) throw new AppError('Proje dashboardundaki widget farklı bir projeye bağlanamaz.', 400);
            const width = clamp(widget.width, definition.minWidth, 12, 4);
            return {
                id: widgetId,
                type,
                title: (typeof widget.title === 'string' && widget.title.trim() ? widget.title.trim() : definition.defaultTitle).slice(0, 100),
                positionX: clamp(widget.positionX, 0, 12 - width, index % 3 * 4), positionY: clamp(widget.positionY, 0, 1000, Math.floor(index / 3) * 3),
                width, height: clamp(widget.height, definition.minHeight, 12, 3),
                config: config as Prisma.InputJsonValue,
            };
        });
        return prisma.$transaction(async (tx) => {
            const claimed = await tx.dashboardDefinition.updateMany({
                where: {
                    id: dashboard.id,
                    organizationId: actor.organizationId,
                    layoutVersion: Number(expectedLayoutVersion),
                    deletedAt: null,
                    AND: [this.visibilityWhere(actor, projectIds, true)],
                },
                data: { layoutVersion: { increment: 1 } },
            });
            if (claimed.count !== 1) throw new AppError('Dashboard başka bir oturumda güncellendi. En son düzeni yükleyip yeniden deneyin.', 409);
            await tx.dashboardWidget.deleteMany({ where: { dashboardId: dashboard.id, id: { notIn: normalized.map((item) => item.id).filter((value): value is string => Boolean(value)) } } });
            for (const widget of normalized) {
                const { id: widgetId, ...data } = widget;
                if (widgetId) await tx.dashboardWidget.update({ where: { id: widgetId, dashboardId: dashboard.id }, data });
                else await tx.dashboardWidget.create({ data: { ...data, dashboardId: dashboard.id } });
            }
            return tx.dashboardDefinition.findUniqueOrThrow({ where: { id: dashboard.id }, include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } } });
        });
    }

    async setDefault(actor: Actor, id: string) {
        const dashboard = await this.getAccessible(id, actor);
        await prisma.dashboardPreference.upsert({
            where: { userId_organizationId: { userId: actor.userId, organizationId: actor.organizationId } },
            create: { userId: actor.userId, organizationId: actor.organizationId, dashboardId: dashboard.id },
            update: { dashboardId: dashboard.id },
        });
        return { ...dashboard, isDefault: true };
    }

    async archive(actor: Actor, id: string) {
        const dashboard = await this.getAccessible(id, actor, true);
        if (dashboard.ownerId !== actor.userId && !this.isAdmin(actor)) throw new AppError('Dashboard silme yetkiniz yok.', 403);
        const item = await prisma.$transaction(async (tx) => {
            await tx.dashboardPreference.deleteMany({ where: { dashboardId: dashboard.id, organizationId: actor.organizationId } });
            return tx.dashboardDefinition.update({ where: { id: dashboard.id }, data: { deletedAt: new Date(), isDefault: false } });
        });
        return { before: dashboard, item };
    }

    private async widgetData(type: DashboardWidgetType, actor: Actor, projectIds: string[], config: Record<string, unknown>, dashboardProjectRestricted: boolean) {
        if (config.projectId !== undefined && (typeof config.projectId !== 'string' || !config.projectId.trim())) throw new AppError('Widget proje filtresi geçersiz.', 400);
        const configuredProjectId = typeof config.projectId === 'string' ? config.projectId.trim() : undefined;
        if (configuredProjectId && !projectIds.includes(configuredProjectId)) throw new AppError('Widget için seçilen projeye erişim yetkiniz yok.', 403);
        const scopeIds = configuredProjectId ? [configuredProjectId] : projectIds;
        const projectRestricted = dashboardProjectRestricted || Boolean(configuredProjectId);
        if (type === 'KPI_WORK_ITEMS') return { value: await prisma.workItem.count({ where: { projectId: { in: scopeIds }, deletedAt: null, status: { notIn: ['DONE', 'CLOSED'] } } }), unit: 'COUNT' };
        if (type === 'KPI_CRITICAL_BUGS') return { value: await prisma.workItem.count({ where: { projectId: { in: scopeIds }, deletedAt: null, itemType: { in: ['BUG', 'DEFECT'] }, severity: 'CRITICAL', status: { notIn: ['DONE', 'CLOSED'] } } }), unit: 'COUNT' };
        if (type === 'KPI_PASS_RATE') {
            if (scopeIds.length === 0) return { value: 0, unit: 'PERCENT', sampleSize: 0 };
            const from = new Date(Date.now() - 30 * 86_400_000);
            const grouped = await prisma.executionEvent.groupBy({ by: ['status'], where: { projectId: { in: scopeIds }, createdAt: { gte: from }, run: { deletedAt: null } }, _count: { status: true } });
            const total = grouped.reduce((sum, item) => sum + item._count.status, 0); const pass = grouped.find((item) => item.status === 'PASS')?._count.status || 0;
            return { value: total ? Math.round(pass / total * 100) : 0, unit: 'PERCENT', sampleSize: total };
        }
        if (type === 'KPI_RELEASE_READINESS') {
            if (scopeIds.length === 0) return { value: 0, unit: 'PERCENT', sampleSize: 0 };
            const releases = await prisma.$queryRaw<Array<{ readinessScore: number }>>(Prisma.sql`
                SELECT DISTINCT ON ("projectId") "readinessScore"
                FROM "ReleaseCandidate"
                WHERE "projectId" IN (${Prisma.join(scopeIds)})
                  AND "deletedAt" IS NULL
                  AND "readinessScore" IS NOT NULL
                ORDER BY "projectId", "createdAt" DESC, "id" DESC
            `);
            const scores = releases.map((item) => Number(item.readinessScore)).filter(Number.isFinite);
            return { value: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0, unit: 'PERCENT', sampleSize: scores.length };
        }
        if (type === 'STATUS_DISTRIBUTION') {
            const grouped = await prisma.workItem.groupBy({ by: ['status'], where: { projectId: { in: scopeIds }, deletedAt: null }, _count: { status: true } });
            return { series: grouped.map((item) => ({ name: item.status, value: item._count.status })) };
        }
        if (type === 'EXECUTION_TREND') {
            const from = new Date(Date.now() - 30 * 86_400_000);
            if (scopeIds.length === 0) return { series: [] };
            const results = await prisma.$queryRaw<Array<{ day: string; status: string; count: number }>>(Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('day', ee."createdAt"), 'YYYY-MM-DD') AS "day",
                       ee."status"::text AS "status", COUNT(*)::int AS "count"
                FROM "ExecutionEvent" ee
                JOIN "TestRun" tr ON tr."id" = ee."runId" AND tr."deletedAt" IS NULL
                WHERE ee."projectId" IN (${Prisma.join(scopeIds)}) AND ee."createdAt" >= ${from}
                GROUP BY DATE_TRUNC('day', ee."createdAt"), ee."status"
                ORDER BY DATE_TRUNC('day', ee."createdAt") ASC
            `);
            const days = new Map<string, Record<string, number>>(); for (const result of results) { const row = days.get(result.day) || {}; row[result.status] = result.count; days.set(result.day, row); }
            return { series: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, values]) => ({ day, ...values })) };
        }
        if (type === 'MY_WORK') {
            const [workItems, testItems] = await Promise.all([
                prisma.workItem.findMany({
                    where: { projectId: { in: scopeIds }, assigneeId: actor.userId, deletedAt: null, status: { notIn: ['DONE', 'CLOSED'] } },
                    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
                    take: 8,
                    select: { id: true, key: true, title: true, itemType: true, status: true, priority: true, updatedAt: true, project: { select: { key: true, name: true } } },
                }),
                prisma.testRunItem.findMany({
                    where: { assigneeId: actor.userId, finalStatus: { in: ['UNTESTED', 'FAIL', 'BLOCK', 'RETEST'] }, testRun: { projectId: { in: scopeIds }, status: 'OPEN', deletedAt: null } },
                    orderBy: { testRun: { dueDate: 'asc' } },
                    take: 8,
                    select: { id: true, caseTitle: true, casePriority: true, finalStatus: true, testRun: { select: { key: true, title: true, dueDate: true, project: { select: { key: true, name: true } } } } },
                }),
            ]);
            return { workItems, testItems };
        }
        if (type === 'RISK_ACTIONS') {
            const visibleScopes: Prisma.ActionCenterItemWhereInput[] = [{ projectId: { in: scopeIds } }];
            if (!projectRestricted) visibleScopes.push(this.isManager(actor)
                ? { projectId: null }
                : { projectId: null, OR: [{ assigneeId: actor.userId }, { createdById: actor.userId }] });
            return { items: await prisma.actionCenterItem.findMany({
                where: {
                    organizationId: actor.organizationId,
                    status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
                    AND: [
                        { OR: visibleScopes },
                        { OR: [{ assigneeId: actor.userId }, { assigneeId: null }] },
                        { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }] },
                    ],
                },
                orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }],
                take: 10,
                select: { id: true, projectId: true, assigneeId: true, title: true, description: true, severity: true, status: true, dueDate: true, actionUrl: true, metadata: true },
            }) };
        }
        if (type === 'PORTFOLIO_HEALTH') {
            const portfolioWhere: Prisma.PortfolioWhereInput = {
                organizationId: actor.organizationId,
                status: 'ACTIVE',
                ...(projectRestricted ? { projects: { some: { projectId: { in: scopeIds } } } } : {}),
            };
            const initiativeWhere: Prisma.PortfolioInitiativeWhereInput = {
                program: { portfolio: { organizationId: actor.organizationId } },
                ...(projectRestricted ? { projectId: { in: scopeIds } } : {}),
            };
            const [portfolios, initiatives] = await Promise.all([
                prisma.portfolio.count({ where: portfolioWhere }),
                prisma.portfolioInitiative.groupBy({ by: ['status'], where: initiativeWhere, _count: { status: true } }),
            ]);
            return { portfolios, series: initiatives.map((item) => ({ name: item.status, value: item._count.status })) };
        }
        return {};
    }

    async data(actor: Actor, id: string) {
        const accessibleProjectIds = await this.accessibleProjectIds(actor);
        const dashboard = await this.getAccessible(id, actor, false, accessibleProjectIds);
        const projectIds = dashboard.projectId ? accessibleProjectIds.filter((projectId) => projectId === dashboard.projectId) : accessibleProjectIds;
        const widgets: Array<{ id: string; type: DashboardWidgetType; data?: unknown; error?: string }> = new Array(dashboard.widgets.length);
        const cache = new Map<string, Promise<unknown>>();
        let cursor = 0;
        const worker = async () => {
            while (cursor < dashboard.widgets.length) {
                const index = cursor;
                cursor += 1;
                const widget = dashboard.widgets[index];
                const config = isRecord(widget.config) ? widget.config : {};
                const cacheKey = `${widget.type}:${JSON.stringify(config)}`;
                try {
                    let query = cache.get(cacheKey);
                    if (!query) {
                        query = this.widgetData(widget.type, actor, projectIds, config, Boolean(dashboard.projectId));
                        cache.set(cacheKey, query);
                    }
                    widgets[index] = { id: widget.id, type: widget.type, data: await query };
                } catch (error) {
                    if (!(error instanceof AppError)) logger.error('Widget verisi oluşturulamadı.', { dashboardId: dashboard.id, widgetId: widget.id, widgetType: widget.type, error });
                    widgets[index] = { id: widget.id, type: widget.type, error: error instanceof AppError ? error.message : 'Widget verisi alınamadı.' };
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(6, dashboard.widgets.length) }, () => worker()));
        return { dashboard, widgets, generatedAt: new Date() };
    }
}

export const dashboardStudioService = new DashboardStudioService();
