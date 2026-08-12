import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

const schema = ['urn:ietf:params:scim:schemas:core:2.0:User'];
const scimUser = (user: { id: string; email: string; firstName: string; lastName: string; isActive: boolean }) => ({
    schemas: schema, id: user.id, userName: user.email, active: user.isActive,
    name: { givenName: user.firstName, familyName: user.lastName },
    emails: [{ value: user.email, primary: true, type: 'work' }],
    meta: { resourceType: 'User' },
});

export const scimController = {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const organizationId = req.scimOrganizationId!;
            const match = typeof req.query.filter === 'string' ? req.query.filter.match(/^userName eq "([^"]+)"$/i) : null;
            const startIndex = Math.max(1, Number(req.query.startIndex) || 1);
            const count = Math.min(100, Math.max(1, Number(req.query.count) || 50));
            const where = { organizationMemberships: { some: { organizationId } }, ...(match ? { email: match[1].toLowerCase() } : {}) };
            const [users, totalResults] = await prisma.$transaction([
                prisma.user.findMany({ where, skip: startIndex - 1, take: count, orderBy: { email: 'asc' } }),
                prisma.user.count({ where }),
            ]);
            return res.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'], totalResults, startIndex, itemsPerPage: users.length, Resources: users.map(scimUser) });
        } catch (error) { return next(error); }
    },
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await prisma.user.findFirst({ where: { id: req.params.id, organizationMemberships: { some: { organizationId: req.scimOrganizationId! } } } });
            if (!user) throw new AppError('SCIM user not found', 404);
            return res.json(scimUser(user));
        } catch (error) { return next(error); }
    },
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const email = String(req.body.userName || req.body.emails?.[0]?.value || '').toLowerCase();
            if (!email.includes('@')) throw new AppError('userName must be an email address', 400);
            const existing = await prisma.user.findUnique({ where: { email } });
            const user = existing || await prisma.user.create({ data: { email, password: '', firstName: req.body.name?.givenName || 'User', lastName: req.body.name?.familyName || '-', isActive: req.body.active !== false, emailVerifiedAt: new Date() } });
            await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: req.scimOrganizationId!, userId: user.id } }, update: {}, create: { organizationId: req.scimOrganizationId!, userId: user.id } });
            res.status(201).setHeader('Location', `${req.baseUrl}/Users/${user.id}`);
            return res.json(scimUser(user));
        } catch (error) { return next(error); }
    },
    async patch(req: Request, res: Response, next: NextFunction) {
        try {
            const organizationId = req.scimOrganizationId!;
            const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: req.params.id } } });
            if (!membership) throw new AppError('SCIM user not found', 404);
            const data: Record<string, unknown> = {};
            for (const operation of req.body.Operations || []) {
                const path = String(operation.path || '').toLowerCase();
                if (path === 'active') data.isActive = Boolean(operation.value);
                if (path === 'name.givenname') data.firstName = String(operation.value);
                if (path === 'name.familyname') data.lastName = String(operation.value);
            }
            const user = await prisma.user.update({ where: { id: req.params.id }, data: { ...data, ...('isActive' in data && data.isActive === false ? { tokenVersion: { increment: 1 } } : {}) } });
            if (data.isActive === false) await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
            return res.json(scimUser(user));
        } catch (error) { return next(error); }
    },
    async remove(req: Request, res: Response, next: NextFunction) {
        try {
            const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: req.scimOrganizationId!, userId: req.params.id } } });
            if (!membership) throw new AppError('SCIM user not found', 404);
            await prisma.$transaction([
                prisma.user.update({ where: { id: req.params.id }, data: { isActive: false, tokenVersion: { increment: 1 } } }),
                prisma.authSession.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
            ]);
            return res.status(204).send();
        } catch (error) { return next(error); }
    },
};
