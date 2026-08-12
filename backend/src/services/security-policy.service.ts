import { BlockList, isIP } from 'node:net';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export type SecurityPolicyInput = {
    enforceSso: boolean;
    requireMfa: boolean;
    allowedIpRanges: string[];
    sessionIdleMinutes: number;
    sessionMaxMinutes: number;
    auditRetentionDays: number;
    dataResidency: 'TR' | 'EU' | 'GLOBAL';
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicyInput = {
    enforceSso: false,
    requireMfa: false,
    allowedIpRanges: [],
    sessionIdleMinutes: 60,
    sessionMaxMinutes: 1440,
    auditRetentionDays: 2555,
    dataResidency: 'TR',
};

const normalizeIp = (value?: string) => {
    const first = value?.split(',')[0]?.trim() || '';
    return first.startsWith('::ffff:') ? first.slice(7) : first;
};

const validateRanges = (ranges: string[]) => {
    for (const value of ranges) {
        const [address, prefixText] = value.trim().split('/');
        const family = isIP(address);
        if (!family) throw new AppError(`Geçersiz IP veya CIDR: ${value}`, 400);
        if (prefixText !== undefined) {
            const prefix = Number(prefixText);
            const maximum = family === 4 ? 32 : 128;
            if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximum) throw new AppError(`Geçersiz CIDR: ${value}`, 400);
        }
    }
};

export class SecurityPolicyService {
    async get(organizationId: string): Promise<SecurityPolicyInput & { organizationId: string; updatedAt: Date | null }> {
        const [policy] = await prisma.$queryRaw<Array<SecurityPolicyInput & { organizationId: string; updatedAt: Date }>>`
            SELECT "organizationId", "enforceSso", "requireMfa", "allowedIpRanges", "sessionIdleMinutes", "sessionMaxMinutes", "auditRetentionDays", "dataResidency"::text AS "dataResidency", "updatedAt"
            FROM "OrganizationSecurityPolicy" WHERE "organizationId" = ${organizationId}
        `;
        return policy
            ? { ...policy }
            : { organizationId, ...DEFAULT_SECURITY_POLICY, updatedAt: null };
    }

    async update(organizationId: string, input: SecurityPolicyInput) {
        validateRanges(input.allowedIpRanges);
        if (!Number.isInteger(input.sessionIdleMinutes) || input.sessionIdleMinutes < 5 || input.sessionIdleMinutes > 1440) throw new AppError('Boşta kalma süresi 5-1440 dakika olmalıdır', 400);
        if (!Number.isInteger(input.sessionMaxMinutes) || input.sessionMaxMinutes < 15 || input.sessionMaxMinutes > 43200) throw new AppError('Azami oturum süresi 15-43200 dakika olmalıdır', 400);
        if (input.sessionIdleMinutes > input.sessionMaxMinutes) throw new AppError('Boşta kalma süresi azami oturum süresinden uzun olamaz', 400);
        if (!Number.isInteger(input.auditRetentionDays) || input.auditRetentionDays < 365 || input.auditRetentionDays > 3650) throw new AppError('Denetim kaydı saklama süresi 365-3650 gün olmalıdır', 400);

        if (input.enforceSso) {
            const provider = await prisma.oidcProvider.findFirst({ where: { organizationId, isActive: true }, select: { id: true } });
            if (!provider) throw new AppError('SSO zorunlu kılınmadan önce etkin bir OIDC sağlayıcısı yapılandırılmalıdır', 409);
        }
        if (input.requireMfa) {
            const missingMfa = await prisma.organizationMember.count({ where: { organizationId, user: { isActive: true, mfaEnabled: false } } });
            if (missingMfa > 0) throw new AppError(`MFA etkin olmayan ${missingMfa} aktif kullanıcı var`, 409);
        }

        const ranges = input.allowedIpRanges.map((value) => value.trim());
        const [policy] = await prisma.$queryRaw<Array<SecurityPolicyInput & { organizationId: string; updatedAt: Date }>>(Prisma.sql`
            INSERT INTO "OrganizationSecurityPolicy" ("organizationId", "enforceSso", "requireMfa", "allowedIpRanges", "sessionIdleMinutes", "sessionMaxMinutes", "auditRetentionDays", "dataResidency", "updatedAt")
            VALUES (${organizationId}, ${input.enforceSso}, ${input.requireMfa}, ${ranges}, ${input.sessionIdleMinutes}, ${input.sessionMaxMinutes}, ${input.auditRetentionDays}, ${input.dataResidency}::"DataResidencyRegion", NOW())
            ON CONFLICT ("organizationId") DO UPDATE SET "enforceSso" = EXCLUDED."enforceSso", "requireMfa" = EXCLUDED."requireMfa", "allowedIpRanges" = EXCLUDED."allowedIpRanges", "sessionIdleMinutes" = EXCLUDED."sessionIdleMinutes", "sessionMaxMinutes" = EXCLUDED."sessionMaxMinutes", "auditRetentionDays" = EXCLUDED."auditRetentionDays", "dataResidency" = EXCLUDED."dataResidency", "updatedAt" = NOW()
            RETURNING "organizationId", "enforceSso", "requireMfa", "allowedIpRanges", "sessionIdleMinutes", "sessionMaxMinutes", "auditRetentionDays", "dataResidency"::text AS "dataResidency", "updatedAt"
        `);
        await prisma.authSession.updateMany({ where: { organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
        return policy;
    }

    assertIpAllowed(policy: Pick<SecurityPolicyInput, 'allowedIpRanges'>, rawIp?: string) {
        if (policy.allowedIpRanges.length === 0) return;
        const ip = normalizeIp(rawIp);
        const family = isIP(ip);
        if (!family) throw new AppError('İstemci IP adresi doğrulanamadı', 403);
        const list = new BlockList();
        for (const range of policy.allowedIpRanges) {
            const [address, prefixText] = range.split('/');
            const rangeFamily = isIP(address) === 6 ? 'ipv6' : 'ipv4';
            if (prefixText === undefined) list.addAddress(address, rangeFamily);
            else list.addSubnet(address, Number(prefixText), rangeFamily);
        }
        if (!list.check(ip, family === 6 ? 'ipv6' : 'ipv4')) throw new AppError('Bu ağdan erişime izin verilmiyor', 403);
    }

    assertSessionActive(policy: SecurityPolicyInput, session: { createdAt: Date; lastUsedAt: Date }, rawIp?: string) {
        this.assertIpAllowed(policy, rawIp);
        const now = Date.now();
        if (now - session.lastUsedAt.getTime() > policy.sessionIdleMinutes * 60_000) throw new AppError('Oturum hareketsizlik nedeniyle sona erdi', 401);
        if (now - session.createdAt.getTime() > policy.sessionMaxMinutes * 60_000) throw new AppError('Azami oturum süresi doldu', 401);
    }
}

export const securityPolicyService = new SecurityPolicyService();
