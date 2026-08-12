import { api } from './api';
import type { LoginResponse } from '@/types/auth';
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    mfaCode: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
    organizationSlug: z.string().max(100).optional(),
});


export type LoginCredentials = z.infer<typeof loginSchema>;

export const authService = {
    login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        const response = await api.post('/auth/login', {
            email: credentials.email,
            password: credentials.password,
            ...(credentials.mfaCode ? { mfaCode: credentials.mfaCode } : {}),
            ...(credentials.organizationSlug ? { organizationSlug: credentials.organizationSlug } : {}),
        }) as unknown as { data: LoginResponse };
        return response.data;
    },
    getOidcProviders: async (domain: string): Promise<Array<{ id: string; name: string }>> => {
        const response = await api.get('/auth/oidc-providers', { params: { domain } }) as unknown as { data: Array<{ id: string; name: string }> };
        return response.data;
    },
    requestPasswordReset: async (email: string): Promise<void> => {
        await api.post('/auth/forgot-password', { email });
    },
    resetPassword: async (token: string, password: string): Promise<void> => {
        await api.post('/auth/reset-password', { token, password });
    },
    refresh: async (): Promise<{ token: string; expiresIn: number; user?: LoginResponse['user']; projectPermissions?: Record<string, string[]> }> => {
        const response = await api.post('/auth/refresh') as unknown as { data: { token: string; expiresIn: number; user?: LoginResponse['user']; projectPermissions?: Record<string, string[]> } };
        return response.data;
    },
    verifyEmail: async (token: string): Promise<void> => { await api.post('/auth/verify-email', { token }); },
    beginMfa: async (): Promise<{ secret: string; otpauthUrl: string }> => {
        const response = await api.post('/auth/mfa/setup') as unknown as { data: { secret: string; otpauthUrl: string } };
        return response.data;
    },
    confirmMfa: async (token: string): Promise<void> => { await api.post('/auth/mfa/confirm', { token }); },
    disableMfa: async (token: string): Promise<void> => { await api.post('/auth/mfa/disable', { token }); },
};
