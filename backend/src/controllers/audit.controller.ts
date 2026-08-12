import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { AppError } from '../utils/AppError';

const organizationId = (req: Request) => {
    if (!req.user?.organizationId) throw new AppError('Kurum kapsamı bulunamadı.', 403);
    return req.user.organizationId;
};
const filtersFrom = (req: Request) => ({
    projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
    actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
    entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
    entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    from: typeof req.query.from === 'string' && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : undefined,
    to: typeof req.query.to === 'string' && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : undefined,
});

export const auditController = {
    async verify(req: Request, res: Response, next: NextFunction) {
        try { return res.json({ success: true, data: await auditService.verifyChain(organizationId(req)) }); }
        catch (error) { return next(error); }
    },
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await auditService.query(organizationId(req), {
                ...filtersFrom(req),
                skip: Number(req.query.skip) || 0, take: Number(req.query.take) || 50,
            });
            return res.json({ success: true, data: result });
        } catch (error) { return next(error); }
    },
    async exportCsv(req: Request, res: Response, next: NextFunction) {
        try {
            const { items } = await auditService.query(organizationId(req), { ...filtersFrom(req), take: 500 });
            const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const rows = [['timestamp', 'actor', 'action', 'entityType', 'entityId', 'projectId', 'integrityHash'], ...items.map((item) => [item.createdAt.toISOString(), item.actor?.email || item.actorId || '', item.action, item.entityType, item.entityId, item.projectId || '', item.integrityHash || ''])];
            res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
            return res.send(rows.map((row) => row.map(escape).join(',')).join('\n'));
        } catch (error) { return next(error); }
    },
};
