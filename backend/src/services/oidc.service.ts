import { generators, Issuer } from 'openid-client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { decryptString, encryptString } from '../utils/crypto';
import { sessionService, SessionMetadata } from './session.service';
import { securityPolicyService } from './security-policy.service';

export class OidcService {
    async start(providerId: string) {
        const provider = await prisma.oidcProvider.findFirst({ where: { id: providerId, isActive: true } });
        if (!provider) throw new AppError('OIDC provider not found', 404);
        const issuer = await Issuer.discover(provider.issuer);
        const client = new issuer.Client({
            client_id: provider.clientId,
            client_secret: decryptString(provider.clientSecretEncrypted),
            redirect_uris: [this.redirectUri(providerId)],
            response_types: ['code'],
        });
        const codeVerifier = generators.codeVerifier();
        const nonce = generators.nonce();
        const state = encryptString(JSON.stringify({ providerId, codeVerifier, nonce, expiresAt: Date.now() + 10 * 60 * 1000 }));
        const authorizationUrl = client.authorizationUrl({
            scope: provider.scopes,
            state,
            nonce,
            code_challenge: generators.codeChallenge(codeVerifier),
            code_challenge_method: 'S256',
        });
        return { authorizationUrl, state };
    }

    async callback(providerId: string, callbackUrl: string, metadata: SessionMetadata, expectedState?: string) {
        const provider = await prisma.oidcProvider.findFirst({ where: { id: providerId, isActive: true } });
        if (!provider) throw new AppError('OIDC provider not found', 404);
        securityPolicyService.assertIpAllowed(await securityPolicyService.get(provider.organizationId), metadata.ip);
        const url = new URL(callbackUrl, process.env.BACKEND_PUBLIC_URL);
        const state = url.searchParams.get('state');
        if (!state) throw new AppError('OIDC state is missing', 400);
        if (!expectedState || state !== expectedState) throw new AppError('OIDC state is not bound to this browser session', 400);
        let stateData: { providerId: string; codeVerifier: string; nonce: string; expiresAt: number };
        try {
            stateData = JSON.parse(decryptString(state));
        } catch {
            throw new AppError('OIDC state is invalid', 400);
        }
        if (stateData.providerId !== providerId) throw new AppError('OIDC state mismatch', 400);
        if (!stateData.expiresAt || stateData.expiresAt <= Date.now()) throw new AppError('OIDC state has expired', 400);

        const issuer = await Issuer.discover(provider.issuer);
        const client = new issuer.Client({ client_id: provider.clientId, client_secret: decryptString(provider.clientSecretEncrypted), redirect_uris: [this.redirectUri(providerId)], response_types: ['code'] });
        let tokenSet;
        try {
            tokenSet = await client.callback(this.redirectUri(providerId), client.callbackParams(url.toString()), { state, nonce: stateData.nonce, code_verifier: stateData.codeVerifier });
        } catch {
            throw new AppError('OIDC callback validation failed', 400);
        }
        const claims = tokenSet.claims();
        if (claims.email_verified !== true) throw new AppError('OIDC email address is not verified', 403);
        const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
        if (!email) throw new AppError('OIDC provider did not return an email address', 400);
        const domain = email.split('@')[1];
        if (provider.allowedDomains.length && !provider.allowedDomains.includes(domain)) throw new AppError('Email domain is not allowed', 403);

        const names = String(claims.name || email.split('@')[0]).trim().split(/\s+/);
        const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
        if (existingUser && !existingUser.isActive) throw new AppError('User account is deactivated. Contact an administrator.', 403);
        const user = await prisma.user.upsert({
            where: { email },
            update: { emailVerifiedAt: new Date() },
            create: { email, password: '', firstName: names[0] || 'User', lastName: names.slice(1).join(' ') || '-', emailVerifiedAt: new Date() },
        });
        await prisma.organizationMember.upsert({
            where: { organizationId_userId: { organizationId: provider.organizationId, userId: user.id } },
            update: {},
            create: { organizationId: provider.organizationId, userId: user.id },
        });
        const session = await sessionService.create(user, provider.organizationId, metadata);
        return { user, ...session };
    }

    private redirectUri(providerId: string) {
        const base = process.env.BACKEND_PUBLIC_URL;
        if (!base) throw new Error('BACKEND_PUBLIC_URL is required for OIDC');
        return `${base.replace(/\/$/, '')}/api/v1/auth/oidc/${providerId}/callback`;
    }
}

export const oidcService = new OidcService();
