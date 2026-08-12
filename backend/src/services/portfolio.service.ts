import { InitiativeStatus, PortfolioDependencyType, PortfolioStatus, Priority, WorkItemStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

type Actor = { userId: string; organizationId: string; role: string };
type DateInput = string | Date | null | undefined;

const date = (value: DateInput) => value ? new Date(value) : null;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const completedStatuses: WorkItemStatus[] = ['DONE', 'CLOSED'];

export class PortfolioService {
    private assertManager(actor: Actor) {
        if (!['ADMIN', 'TEAM_LEADER'].includes(actor.role)) throw new AppError('Portföy yönetimi için yönetici yetkisi gereklidir.', 403);
    }

    private async portfolio(id: string, actor: Actor) {
        const portfolio = await prisma.portfolio.findFirst({ where: { id, organizationId: actor.organizationId } });
        if (!portfolio) throw new AppError('Portföy bulunamadı.', 404);
        return portfolio;
    }

    async list(actor: Actor) {
        const portfolios = await prisma.portfolio.findMany({
            where: { organizationId: actor.organizationId, status: { not: 'ARCHIVED' } },
            orderBy: { updatedAt: 'desc' },
            include: {
                owner: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { programs: true, projects: true } },
                programs: { select: { _count: { select: { initiatives: true } } } },
            },
        });
        return portfolios.map((portfolio) => ({
            ...portfolio,
            initiativeCount: portfolio.programs.reduce((total, program) => total + program._count.initiatives, 0),
            programs: undefined,
        }));
    }

    async create(actor: Actor, input: { name?: string; description?: string; startDate?: DateInput; targetDate?: DateInput }) {
        this.assertManager(actor);
        if (!input.name?.trim()) throw new AppError('Portföy adı zorunludur.', 400);
        return prisma.portfolio.create({ data: {
            organizationId: actor.organizationId, ownerId: actor.userId, name: input.name.trim(), description: input.description?.trim(),
            startDate: date(input.startDate), targetDate: date(input.targetDate),
        } });
    }

    async update(actor: Actor, id: string, input: { name?: string; description?: string; status?: PortfolioStatus; startDate?: DateInput; targetDate?: DateInput }) {
        this.assertManager(actor); await this.portfolio(id, actor);
        return prisma.portfolio.update({ where: { id }, data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.startDate !== undefined ? { startDate: date(input.startDate) } : {}),
            ...(input.targetDate !== undefined ? { targetDate: date(input.targetDate) } : {}),
        } });
    }

    async createProgram(actor: Actor, portfolioId: string, input: { name?: string; description?: string; color?: string; startDate?: DateInput; targetDate?: DateInput }) {
        this.assertManager(actor); await this.portfolio(portfolioId, actor);
        if (!input.name?.trim()) throw new AppError('Program adı zorunludur.', 400);
        const count = await prisma.portfolioProgram.count({ where: { portfolioId } });
        return prisma.portfolioProgram.create({ data: {
            portfolioId, name: input.name.trim(), description: input.description?.trim(), color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color! : '#2563eb',
            startDate: date(input.startDate), targetDate: date(input.targetDate), orderIndex: count,
        } });
    }

    async linkProject(actor: Actor, portfolioId: string, input: { projectId?: string; programId?: string; priority?: number }) {
        this.assertManager(actor); await this.portfolio(portfolioId, actor);
        if (!input.projectId) throw new AppError('Proje zorunludur.', 400);
        const project = await prisma.project.findFirst({ where: { id: input.projectId, organizationId: actor.organizationId } });
        if (!project) throw new AppError('Kurum kapsamında proje bulunamadı.', 404);
        if (input.programId) {
            const program = await prisma.portfolioProgram.findFirst({ where: { id: input.programId, portfolioId } });
            if (!program) throw new AppError('Program bu portföye ait değil.', 400);
        }
        return prisma.portfolioProject.upsert({
            where: { portfolioId_projectId: { portfolioId, projectId: input.projectId } },
            create: { portfolioId, projectId: input.projectId, programId: input.programId, priority: clamp(input.priority ?? 50, 0, 100) },
            update: { programId: input.programId || null, priority: clamp(input.priority ?? 50, 0, 100) },
        });
    }

    async createInitiative(actor: Actor, portfolioId: string, input: {
        programId?: string; projectId?: string; parentId?: string; title?: string; description?: string; status?: InitiativeStatus;
        priority?: Priority; startDate?: DateInput; targetDate?: DateInput; estimatedEffortPoints?: number;
    }) {
        this.assertManager(actor); await this.portfolio(portfolioId, actor);
        if (!input.programId || !input.title?.trim()) throw new AppError('Program ve initiative başlığı zorunludur.', 400);
        const program = await prisma.portfolioProgram.findFirst({ where: { id: input.programId, portfolioId } });
        if (!program) throw new AppError('Program bu portföye ait değil.', 400);
        if (input.projectId && !await prisma.portfolioProject.findUnique({ where: { portfolioId_projectId: { portfolioId, projectId: input.projectId } } })) throw new AppError('Önce projeyi portföye ekleyin.', 400);
        if (input.parentId && !await prisma.portfolioInitiative.findFirst({ where: { id: input.parentId, program: { portfolioId } } })) throw new AppError('Üst initiative bu portföye ait değil.', 400);
        return prisma.portfolioInitiative.create({ data: {
            programId: input.programId, projectId: input.projectId, parentId: input.parentId, ownerId: actor.userId,
            title: input.title.trim(), description: input.description?.trim(), status: input.status || 'PLANNED', priority: input.priority || 'MEDIUM',
            startDate: date(input.startDate), targetDate: date(input.targetDate), estimatedEffortPoints: input.estimatedEffortPoints ? Math.max(0, input.estimatedEffortPoints) : null,
        } });
    }

    async updateInitiative(actor: Actor, portfolioId: string, id: string, input: Partial<{ title: string; description: string; status: InitiativeStatus; priority: Priority; startDate: DateInput; targetDate: DateInput; progressOverride: number | null; estimatedEffortPoints: number | null }>) {
        this.assertManager(actor); await this.portfolio(portfolioId, actor);
        const existing = await prisma.portfolioInitiative.findFirst({ where: { id, program: { portfolioId } } });
        if (!existing) throw new AppError('Initiative bulunamadı.', 404);
        return prisma.portfolioInitiative.update({ where: { id }, data: {
            ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
            ...(input.status ? { status: input.status } : {}), ...(input.priority ? { priority: input.priority } : {}),
            ...(input.startDate !== undefined ? { startDate: date(input.startDate) } : {}), ...(input.targetDate !== undefined ? { targetDate: date(input.targetDate) } : {}),
            ...(input.progressOverride !== undefined ? { progressOverride: input.progressOverride == null ? null : clamp(input.progressOverride, 0, 100) } : {}),
            ...(input.estimatedEffortPoints !== undefined ? { estimatedEffortPoints: input.estimatedEffortPoints == null ? null : Math.max(0, input.estimatedEffortPoints) } : {}),
        } });
    }

    async addDependency(actor: Actor, portfolioId: string, input: { sourceInitiativeId?: string; targetInitiativeId?: string; type?: PortfolioDependencyType; lagDays?: number }) {
        this.assertManager(actor); await this.portfolio(portfolioId, actor);
        if (!input.sourceInitiativeId || !input.targetInitiativeId || input.sourceInitiativeId === input.targetInitiativeId) throw new AppError('Geçerli iki farklı initiative seçilmelidir.', 400);
        const count = await prisma.portfolioInitiative.count({ where: { id: { in: [input.sourceInitiativeId, input.targetInitiativeId] }, program: { portfolioId } } });
        if (count !== 2) throw new AppError('Initiative kayıtları bu portföye ait değil.', 400);
        const existingDependencies = await prisma.portfolioDependency.findMany({
            where: { sourceInitiative: { program: { portfolioId } } },
            select: { sourceInitiativeId: true, targetInitiativeId: true },
        });
        const graph = new Map<string, string[]>();
        for (const dependency of existingDependencies) graph.set(dependency.sourceInitiativeId, [...(graph.get(dependency.sourceInitiativeId) || []), dependency.targetInitiativeId]);
        const reaches = (current: string, target: string, visited = new Set<string>()): boolean => {
            if (current === target) return true;
            if (visited.has(current)) return false;
            visited.add(current);
            return (graph.get(current) || []).some((next) => reaches(next, target, visited));
        };
        if (reaches(input.targetInitiativeId, input.sourceInitiativeId)) throw new AppError('Döngüsel bağımlılık oluşturulamaz.', 409);
        return prisma.portfolioDependency.upsert({
            where: { sourceInitiativeId_targetInitiativeId_type: { sourceInitiativeId: input.sourceInitiativeId, targetInitiativeId: input.targetInitiativeId, type: input.type || 'DEPENDS_ON' } },
            create: { sourceInitiativeId: input.sourceInitiativeId, targetInitiativeId: input.targetInitiativeId, type: input.type || 'DEPENDS_ON', lagDays: clamp(input.lagDays ?? 0, 0, 365) },
            update: { lagDays: clamp(input.lagDays ?? 0, 0, 365) },
        });
    }

    async dashboard(actor: Actor, portfolioId: string) {
        await this.portfolio(portfolioId, actor);
        const portfolio = await prisma.portfolio.findUniqueOrThrow({ where: { id: portfolioId }, include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
            projects: { orderBy: { priority: 'desc' }, include: { project: { include: {
                members: { select: { weeklyCapacityMinutes: true } },
                workItems: { where: { deletedAt: null }, select: { status: true, storyPoints: true, itemType: true, severity: true } },
                releaseCandidates: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { readinessScore: true, criticalOpenBugs: true, status: true } },
            } } } },
            programs: { orderBy: { orderIndex: 'asc' }, include: {
                initiatives: { orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }], include: {
                    owner: { select: { id: true, firstName: true, lastName: true } }, project: { select: { id: true, key: true, name: true } },
                    workItems: { where: { deletedAt: null }, select: { status: true, storyPoints: true } },
                    incomingDependencies: true, outgoingDependencies: true,
                } },
            } },
        } });
        const now = Date.now();
        const projects = portfolio.projects.map((membership) => {
            const items = membership.project.workItems;
            const totalPoints = items.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
            const donePoints = items.filter((item) => completedStatuses.includes(item.status)).reduce((sum, item) => sum + (item.storyPoints || 0), 0);
            const criticalBugs = items.filter((item) => ['BUG', 'DEFECT'].includes(item.itemType) && ['CRITICAL', 'BLOCKER'].includes(item.severity || '') && !completedStatuses.includes(item.status)).length;
            const weeklyCapacityMinutes = membership.project.members.reduce((sum, member) => sum + member.weeklyCapacityMinutes, 0);
            const openPoints = Math.max(0, totalPoints - donePoints);
            const utilization = weeklyCapacityMinutes ? clamp(Math.round((openPoints * 480 / weeklyCapacityMinutes) * 100), 0, 999) : 0;
            return { id: membership.project.id, key: membership.project.key, name: membership.project.name, qualityTier: membership.project.qualityTier, priority: membership.priority,
                progress: totalPoints ? Math.round(donePoints / totalPoints * 100) : items.length ? Math.round(items.filter((item) => completedStatuses.includes(item.status)).length / items.length * 100) : 0,
                openPoints, weeklyCapacityMinutes, utilization, criticalBugs, readinessScore: membership.project.releaseCandidates[0]?.readinessScore ?? null };
        });
        const programs = portfolio.programs.map((program) => ({ ...program, initiatives: program.initiatives.map((initiative) => {
            const total = initiative.workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
            const done = initiative.workItems.filter((item) => completedStatuses.includes(item.status)).reduce((sum, item) => sum + (item.storyPoints || 0), 0);
            const progress = initiative.progressOverride ?? (total ? Math.round(done / total * 100) : initiative.status === 'DONE' ? 100 : 0);
            const overdue = Boolean(initiative.targetDate && initiative.targetDate.getTime() < now && progress < 100);
            const blockedBy = initiative.incomingDependencies.length;
            const riskScore = clamp((overdue ? 45 : 0) + (initiative.status === 'BLOCKED' ? 40 : initiative.status === 'AT_RISK' ? 25 : 0) + blockedBy * 8 + (initiative.priority === 'CRITICAL' && progress < 50 ? 12 : 0), 0, 100);
            return { ...initiative, progress, overdue, riskScore, workItems: undefined };
        }) }));
        const initiatives = programs.flatMap((program) => program.initiatives);
        const byId = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
        const successors = new Map<string, string[]>();
        for (const initiative of initiatives) for (const dependency of initiative.incomingDependencies) {
            successors.set(dependency.sourceInitiativeId, [...(successors.get(dependency.sourceInitiativeId) || []), dependency.targetInitiativeId]);
        }
        const memo = new Map<string, { days: number; path: string[] }>();
        const longest = (id: string, visiting = new Set<string>()): { days: number; path: string[] } => {
            if (memo.has(id)) return memo.get(id)!;
            if (visiting.has(id)) return { days: 0, path: [] };
            const initiative = byId.get(id); if (!initiative) return { days: 0, path: [] };
            const ownDays = initiative.startDate && initiative.targetDate ? Math.max(1, Math.ceil((initiative.targetDate.getTime() - initiative.startDate.getTime()) / 86_400_000)) : Math.max(1, initiative.estimatedEffortPoints || 1);
            const next = (successors.get(id) || []).map((nextId) => longest(nextId, new Set([...visiting, id]))).sort((a, b) => b.days - a.days)[0] || { days: 0, path: [] };
            const result = { days: ownDays + next.days, path: [id, ...next.path] }; memo.set(id, result); return result;
        };
        const critical = initiatives.map((initiative) => longest(initiative.id)).sort((a, b) => b.days - a.days)[0] || { days: 0, path: [] };
        const criticalIds = new Set(critical.path);
        const enrichedPrograms = programs.map((program) => ({ ...program, initiatives: program.initiatives.map((initiative) => ({ ...initiative, criticalPath: criticalIds.has(initiative.id) })) }));
        return { ...portfolio, projects, programs: enrichedPrograms, criticalPath: { initiativeIds: critical.path, durationDays: critical.days }, metrics: {
            projectCount: projects.length, initiativeCount: initiatives.length, atRiskCount: initiatives.filter((item) => item.riskScore >= 40).length,
            blockedCount: initiatives.filter((item) => item.status === 'BLOCKED').length,
            averageProgress: initiatives.length ? Math.round(initiatives.reduce((sum, item) => sum + item.progress, 0) / initiatives.length) : 0,
            capacityUtilization: projects.length ? Math.round(projects.reduce((sum, item) => sum + item.utilization, 0) / projects.length) : 0,
            criticalBugCount: projects.reduce((sum, item) => sum + item.criticalBugs, 0), criticalPathDays: critical.days,
        } };
    }

    async scenario(actor: Actor, portfolioId: string, input: { capacityDeltaPercent?: number; addedEffortPoints?: number; targetDateShiftDays?: number }) {
        const dashboard = await this.dashboard(actor, portfolioId);
        const capacityMultiplier = 1 + clamp(input.capacityDeltaPercent || 0, -90, 300) / 100;
        const currentOpenPoints = dashboard.projects.reduce((sum, project) => sum + project.openPoints, 0);
        const currentCapacityPoints = dashboard.projects.reduce((sum, project) => sum + project.weeklyCapacityMinutes / 480, 0);
        const effort = Math.max(0, currentOpenPoints + (input.addedEffortPoints || 0));
        const capacity = Math.max(0.1, currentCapacityPoints * capacityMultiplier);
        const forecastWeeks = effort / capacity;
        const baselineWeeks = currentOpenPoints / Math.max(0.1, currentCapacityPoints);
        const targetDate = dashboard.targetDate ? new Date(dashboard.targetDate) : null;
        if (targetDate) targetDate.setDate(targetDate.getDate() + (input.targetDateShiftDays || 0));
        const availableWeeks = targetDate ? Math.max(0, (targetDate.getTime() - Date.now()) / 604_800_000) : null;
        const risk = availableWeeks == null ? (forecastWeeks > baselineWeeks * 1.2 ? 'HIGH' : 'MEDIUM') : forecastWeeks > availableWeeks ? 'HIGH' : forecastWeeks > availableWeeks * 0.85 ? 'MEDIUM' : 'LOW';
        return { baselineWeeks: Number(baselineWeeks.toFixed(1)), forecastWeeks: Number(forecastWeeks.toFixed(1)), availableWeeks: availableWeeks == null ? null : Number(availableWeeks.toFixed(1)),
            projectedUtilization: Math.round((availableWeeks ? forecastWeeks / availableWeeks : forecastWeeks / Math.max(0.1, baselineWeeks)) * 100), risk, deltaWeeks: Number((forecastWeeks - baselineWeeks).toFixed(1)), targetDate };
    }
}

export const portfolioService = new PortfolioService();
