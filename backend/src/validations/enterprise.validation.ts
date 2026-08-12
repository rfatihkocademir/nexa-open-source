import { z } from 'zod';

export const createOidcProviderSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(120),
        issuer: z.string().url(),
        clientId: z.string().trim().min(1).max(255),
        clientSecret: z.string().min(1).max(2048),
        scopes: z.string().trim().min(1).max(500).optional(),
        allowedDomains: z.array(z.string().trim().min(1).max(255)).max(100).optional(),
    }),
});
