import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { LoginInput, RegisterInput } from '../validations/auth.validation';
import { expandPermissionKeys, getLegacyProjectPermissions } from '../utils/permissionCatalog';
import { authenticator } from 'otplib';
import { decryptString, encryptString, hashToken, randomToken } from '../utils/crypto';
import { sessionService, SessionMetadata } from './session.service';
import { sendSecurityEmail } from './securityNotification.service';
import { securityPolicyService } from './security-policy.service';

export class AuthService {
    async register(data: RegisterInput, metadata: SessionMetadata = {}) {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.password, salt);

        const defaultSlug = process.env.DEFAULT_ORGANIZATION_SLUG;
        if (!defaultSlug) throw new AppError('DEFAULT_ORGANIZATION_SLUG is required for public registration', 503);
        const organization = await prisma.organization.findUnique({ where: { slug: defaultSlug } });
        if (!organization) throw new AppError('Default organization is not configured', 503);
        const registrationPolicy = await securityPolicyService.get(organization.id);
        securityPolicyService.assertIpAllowed(registrationPolicy, metadata.ip);
        if (registrationPolicy.enforceSso || registrationPolicy.requireMfa) throw new AppError('Bu kurumda herkese açık kayıt kapalıdır', 403);
        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: { ...data, password: hashedPassword, role: 'TESTER', isActive: true },
            });
            await tx.organizationMember.create({ data: { userId: created.id, organizationId: organization.id } });
            return created;
        });

        try {
            await this.sendEmailVerification(user.id, user.email);
        } catch (error) {
            await prisma.user.delete({ where: { id: user.id } });
            throw error;
        }

        const organizationId = organization.id;
        const { password, ...userWithoutPassword } = user;
        if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
            return { user: userWithoutPassword, verificationRequired: true as const };
        }
        const session = await sessionService.create(user, organizationId, metadata);
        return { user: userWithoutPassword, ...session };
    }

    async login(data: LoginInput, metadata: SessionMetadata = {}) {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user || !user.isActive) {
            throw new AppError('Invalid email or password', 401);
        }
        if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerifiedAt) throw new AppError('Email verification is required', 403);

        // Check password
        const isMatch = await bcrypt.compare(data.password, user.password);
        if (!isMatch) {
            throw new AppError('Invalid email or password', 401);
        }

        const organizationId = await this.resolveOrganizationId(user.id, data.organizationSlug);
        const policy = await securityPolicyService.get(organizationId);
        securityPolicyService.assertIpAllowed(policy, metadata.ip);
        if (policy.enforceSso) throw new AppError('Bu kurumda parola ile giriş kapalıdır. Kurumsal SSO kullanın.', 403);
        if (policy.requireMfa && !user.mfaEnabled) throw new AppError('Kurum politikası gereği MFA etkinleştirilmelidir. Yöneticinizle iletişime geçin.', 403);

        if (user.mfaEnabled) {
            if (!data.mfaCode || !user.mfaSecretEncrypted || !authenticator.check(data.mfaCode, decryptString(user.mfaSecretEncrypted))) {
                throw new AppError('A valid MFA code is required', 401);
            }
        }

        const session = await sessionService.create(user, organizationId, metadata);

        const projectPermissions = await this.getUserProjectPermissions(user.id, organizationId);

        const { password, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, ...session, projectPermissions };
    }

    async beginMfaSetup(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError('User not found', 404);
        const secret = authenticator.generateSecret();
        await prisma.user.update({ where: { id: userId }, data: { mfaSecretEncrypted: encryptString(secret), mfaEnabled: false } });
        return { secret, otpauthUrl: authenticator.keyuri(user.email, 'Nexa', secret) };
    }

    async confirmMfa(userId: string, code: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.mfaSecretEncrypted || !authenticator.check(code, decryptString(user.mfaSecretEncrypted))) {
            throw new AppError('Invalid MFA code', 400);
        }
        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true, tokenVersion: { increment: 1 } } }),
            prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
    }

    async disableMfa(userId: string, code: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.mfaSecretEncrypted || !authenticator.check(code, decryptString(user.mfaSecretEncrypted))) {
            throw new AppError('Invalid MFA code', 400);
        }
        const protectedMembership = await prisma.$queryRaw<Array<{ organizationId: string }>>`
            SELECT om."organizationId" FROM "OrganizationMember" om
            JOIN "OrganizationSecurityPolicy" osp ON osp."organizationId" = om."organizationId"
            WHERE om."userId" = ${userId} AND osp."requireMfa" = true LIMIT 1
        `;
        if (protectedMembership.length > 0) throw new AppError('Kurum güvenlik politikası MFA kapatılmasına izin vermiyor', 409);
        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEncrypted: null, tokenVersion: { increment: 1 } } }),
            prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
    }

    async requestPasswordReset(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.isActive) return;
        const token = randomToken(40);
        await prisma.securityToken.deleteMany({ where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null } });
        await prisma.securityToken.create({ data: { userId: user.id, purpose: 'PASSWORD_RESET', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
        const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
        await sendSecurityEmail(user.email, 'password-reset', { token, resetUrl: `${frontend}/reset-password?token=${encodeURIComponent(token)}` });
    }

    async sendEmailVerification(userId: string, email: string) {
        const token = randomToken(40);
        await prisma.securityToken.deleteMany({ where: { userId, purpose: 'EMAIL_VERIFICATION', usedAt: null } });
        await prisma.securityToken.create({ data: { userId, purpose: 'EMAIL_VERIFICATION', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
        await sendSecurityEmail(email, 'email-verification', { token, verificationUrl: `${frontend}/verify-email?token=${encodeURIComponent(token)}` });
    }

    async verifyEmail(token: string) {
        const record = await prisma.securityToken.findUnique({ where: { tokenHash: hashToken(token) } });
        if (!record || record.purpose !== 'EMAIL_VERIFICATION' || record.usedAt || record.expiresAt <= new Date()) throw new AppError('Verification token is invalid or expired', 400);
        await prisma.$transaction([
            prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
            prisma.securityToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
        ]);
    }

    async resetPassword(token: string, password: string) {
        const record = await prisma.securityToken.findUnique({ where: { tokenHash: hashToken(token) } });
        if (!record || record.purpose !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt <= new Date()) throw new AppError('Reset token is invalid or expired', 400);
        await prisma.$transaction([
            prisma.user.update({ where: { id: record.userId }, data: { password: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 } } }),
            prisma.securityToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            prisma.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
    }

    private async resolveOrganizationId(userId: string, organizationSlug?: string) {
        const memberships = await prisma.organizationMember.findMany({ where: { userId, ...(organizationSlug ? { organization: { slug: organizationSlug } } : {}) }, select: { organizationId: true }, take: 2 });
        if (memberships.length === 0) throw new AppError('User does not belong to an organization', 403);
        if (memberships.length > 1) throw new AppError('Organization selection is required', 409);
        return memberships[0].organizationId;
    }

    private async getUserProjectPermissions(userId: string, organizationId: string): Promise<Record<string, string[]>> {
        const members = await prisma.projectMember.findMany({
            where: { userId, project: { organizationId } },
            include: {
                user: {
                    select: { role: true }
                },
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        const result: Record<string, string[]> = {};
        for (const m of members) {
            if (m.role) {
                result[m.projectId] = expandPermissionKeys(m.role.permissions.map(p => p.permission.key));
            } else {
                result[m.projectId] = getLegacyProjectPermissions(m.user?.role || null);
            }
        }
        return result;
    }
}

export const authService = new AuthService();
