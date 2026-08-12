import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { hashToken } from '../utils/crypto';
import { AppError } from '../utils/AppError';

declare global { namespace Express { interface Request { scimOrganizationId?: string } } }

export async function protectScim(req: Request, _res: Response, next: NextFunction) {
    const raw = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    if (!raw) return next(new AppError('SCIM bearer token is required', 401));
    const token = await prisma.scimToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) return next(new AppError('SCIM token is invalid or expired', 401));
    req.scimOrganizationId = token.organizationId;
    await prisma.scimToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    return next();
}
