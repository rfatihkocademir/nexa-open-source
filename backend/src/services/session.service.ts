import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { hashToken, randomToken } from '../utils/crypto';
import { securityPolicyService } from './security-policy.service';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionMetadata = { ip?: string; userAgent?: string };

export class SessionService {
    async create(user: { id: string; role: string; tokenVersion: number }, organizationId: string | null, metadata: SessionMetadata) {
        const refreshToken = randomToken(48);
        const session = await prisma.authSession.create({
            data: {
                userId: user.id,
                organizationId,
                refreshTokenHash: hashToken(refreshToken),
                ip: metadata.ip,
                userAgent: metadata.userAgent,
                expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
            },
        });
        return {
            token: this.accessToken(user, organizationId, session.id),
            refreshToken,
            expiresIn: 15 * 60,
        };
    }

    async rotate(refreshToken: string, metadata: SessionMetadata) {
        const tokenHash = hashToken(refreshToken);
        const session = await prisma.authSession.findFirst({
            where: { refreshTokenHash: tokenHash },
            include: { user: true },
        });
        if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
            if (session?.userId) {
                await prisma.authSession.updateMany({ where: { userId: session.userId }, data: { revokedAt: new Date() } });
            }
            throw new AppError('Refresh session is invalid or expired', 401);
        }
        if (session.organizationId) {
            const policy = await securityPolicyService.get(session.organizationId);
            try { securityPolicyService.assertSessionActive(policy, session, metadata.ip); }
            catch (error) {
                await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
                throw error;
            }
        }

        const nextToken = randomToken(48);
        const rotated = await prisma.authSession.updateMany({
            where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null },
            data: {
                previousRefreshTokenHash: session.refreshTokenHash,
                refreshTokenHash: hashToken(nextToken),
                lastUsedAt: new Date(),
                ip: metadata.ip,
                userAgent: metadata.userAgent,
            },
        });
        if (rotated.count !== 1) {
            await prisma.authSession.updateMany({ where: { userId: session.userId }, data: { revokedAt: new Date() } });
            throw new AppError('Refresh token reuse detected', 401);
        }
        return {
            token: this.accessToken(session.user, session.organizationId, session.id),
            refreshToken: nextToken,
            expiresIn: 15 * 60,
        };
    }

    async revoke(refreshToken?: string, userId?: string, all = false) {
        if (all && userId) {
            await prisma.$transaction([
                prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
                prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
            ]);
            return;
        }
        if (refreshToken) {
            await prisma.authSession.updateMany({
                where: {
                    OR: [
                        { refreshTokenHash: hashToken(refreshToken) },
                        { previousRefreshTokenHash: hashToken(refreshToken) },
                    ],
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            });
        }
    }

    async list(userId: string) {
        return prisma.authSession.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
            orderBy: { lastUsedAt: 'desc' },
        });
    }

    private accessToken(user: { id: string; role: string; tokenVersion: number }, organizationId: string | null, sessionId: string) {
        return jwt.sign(
            { id: user.id, role: user.role, organizationId, sessionId, tokenVersion: user.tokenVersion },
            process.env.JWT_SECRET as string,
            { expiresIn: ACCESS_TTL },
        );
    }
}

export const sessionService = new SessionService();
