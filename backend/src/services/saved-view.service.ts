import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

const ALLOWED_SCOPES = new Set(['PERSONAL', 'PROJECT']);
const ALLOWED_VIEW_TYPES = new Set(['AGILE_BOARD', 'BACKLOG_FILTER', 'WORK_ITEM_SEARCH']);

function validateText(value: unknown, field: string, maxLength: number) {
    if (typeof value !== 'string' || !value.trim()) throw new AppError(`${field} is required`, 400);
    const normalized = value.trim();
    if (normalized.length > maxLength) throw new AppError(`${field} is too long`, 400);
    return normalized;
}

export class SavedViewService {
    async list(projectId: string, userId: string, viewType: string) {
        const normalizedType = validateText(viewType, 'viewType', 40);
        if (!ALLOWED_VIEW_TYPES.has(normalizedType)) throw new AppError('Unsupported viewType', 400);
        return prisma.savedView.findMany({
            where: {
                projectId,
                viewType: normalizedType,
                OR: [{ userId }, { scope: 'PROJECT' }],
            },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
            select: {
                id: true,
                name: true,
                viewType: true,
                scope: true,
                config: true,
                isDefault: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async create(data: Record<string, unknown>, actor: { userId: string; role: string; projectId: string }) {
        const name = validateText(data.name, 'name', 80);
        const viewType = validateText(data.viewType, 'viewType', 40);
        const scope = typeof data.scope === 'string' ? data.scope.toUpperCase() : 'PERSONAL';
        if (!ALLOWED_VIEW_TYPES.has(viewType)) throw new AppError('Unsupported viewType', 400);
        if (!ALLOWED_SCOPES.has(scope)) throw new AppError('Invalid scope', 400);
        if (scope === 'PROJECT' && !['ADMIN', 'TEAM_LEADER'].includes(actor.role.toUpperCase())) {
            throw new AppError('Only administrators and team leaders can create project views', 403);
        }
        if (!data.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
            throw new AppError('config must be an object', 400);
        }

        return prisma.savedView.upsert({
            where: {
                userId_projectId_viewType_name: {
                    userId: actor.userId,
                    projectId: actor.projectId,
                    viewType,
                    name,
                },
            },
            create: {
                name,
                viewType,
                scope,
                config: data.config as object,
                isDefault: Boolean(data.isDefault),
                userId: actor.userId,
                projectId: actor.projectId,
            },
            update: {
                scope,
                config: data.config as object,
                isDefault: Boolean(data.isDefault),
            },
        });
    }

    async delete(id: string, actor: { userId: string; role: string; projectId: string }) {
        const view = await prisma.savedView.findFirst({ where: { id, projectId: actor.projectId } });
        if (!view) throw new AppError('Saved view not found', 404);
        const canManageProjectView = view.scope === 'PROJECT' && ['ADMIN', 'TEAM_LEADER'].includes(actor.role.toUpperCase());
        if (view.userId !== actor.userId && !canManageProjectView) throw new AppError('You cannot delete this view', 403);
        await prisma.savedView.delete({ where: { id } });
    }
}

export const savedViewService = new SavedViewService();
