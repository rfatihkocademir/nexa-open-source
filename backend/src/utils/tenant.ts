import { PrismaClient } from '@prisma/client';

export const withTenant = (prisma: PrismaClient, organizationId: string | null) => {
    if (!organizationId) {
        throw new Error('Tenant context is required');
    }

    // Prisma extensions for RLS / Tenant boundary 
    return prisma.$extends({
        query: {
            project: {
                // Intercept any find or update actions on projects to enforce org isolation
                async $allOperations({ operation, args, query }) {
                    const anyArgs = args as any;
                    if (['findUnique', 'findFirst', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                        anyArgs.where = { ...anyArgs.where, organizationId };
                    } else if (['create', 'createMany'].includes(operation)) {
                        if (Array.isArray(anyArgs.data)) {
                            anyArgs.data.forEach((d: any) => d.organizationId = organizationId);
                        } else {
                            anyArgs.data.organizationId = organizationId;
                        }
                    }
                    return query(anyArgs);
                }
            },
            // Team isolation
            team: {
                async $allOperations({ operation, args, query }) {
                    const anyArgs = args as any;
                    if (['findUnique', 'findFirst', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                        anyArgs.where = { ...anyArgs.where, organizationId };
                    } else if (['create', 'createMany'].includes(operation)) {
                        if (Array.isArray(anyArgs.data)) {
                            anyArgs.data.forEach((d: any) => d.organizationId = organizationId);
                        } else {
                            anyArgs.data.organizationId = organizationId;
                        }
                    }
                    return query(anyArgs);
                }
            }
        }
    });
};
