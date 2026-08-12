import { Request, Response, NextFunction, type RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { accessPolicy, type PolicyKey, type Role } from '../utils/accessPolicy';
import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';
import { getLegacyProjectPermissions, hasPermission } from '../utils/permissionCatalog';
import { protect } from './auth.middleware';

// Extend Express Request to include user (will be populated by auth middleware)
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: Role;
                permissions?: string[];
                organizationId?: string | null;
            };
            projectAccessContext?: {
                projectId: string;
                permissions: string[];
            };
        }
    }
}

export const restrictTo = (...roles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

export const authorize = (policyKey: PolicyKey) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (req.user?.permissions && req.user.permissions.includes(policyKey)) {
            return next();
        }

        const allowedRoles = accessPolicy[policyKey];
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

type ProjectResolver = (req: Request) => Promise<string | null>;

const fromRequest = (req: Request, location: 'params' | 'body' | 'query', key: string): string | undefined => {
    const container = req[location] as Record<string, unknown> | undefined;
    const value = container?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const resolveProjectMemberPermissions = async (
    projectId: string,
    userId: string,
    fallbackRole?: Role,
): Promise<string[]> => {
    const membership = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId,
            },
        },
        include: {
            user: {
                select: {
                    role: true,
                },
            },
            role: {
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            },
        },
    });

    if (!membership) {
        throw new AppError('You do not have access to this project', 403);
    }

    if (!membership.role) {
        return getLegacyProjectPermissions(membership.user?.role ?? fallbackRole);
    }

    return membership.role.permissions.map((entry) => entry.permission.key);
};

const resolveProjectIdByWorkItemId = async (workItemIdentifier?: string): Promise<string | null> => {
    if (!workItemIdentifier) return null;
    const item = await prisma.workItem.findFirst({
        where: {
            OR: [
                { id: workItemIdentifier },
                { key: workItemIdentifier.toUpperCase() },
            ],
        },
        select: { projectId: true },
    });
    return item?.projectId || null;
};

export const projectResolvers = {
    projectId: (...candidates: Array<[location: 'params' | 'body' | 'query', key: string]>): ProjectResolver => {
        return async (req) => {
            for (const [location, key] of candidates) {
                const value = fromRequest(req, location, key);
                if (value) return value;
            }
            return null;
        };
    },
    suiteId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const suiteId = fromRequest(req, location, key);
            if (!suiteId) return null;
            const suite = await prisma.testSuite.findUnique({
                where: { id: suiteId },
                select: { projectId: true },
            });
            return suite?.projectId || null;
        };
    },
    testCaseCreate: (): ProjectResolver => async (req) => {
        const suiteId = req.body?.suiteId;
        if (suiteId) {
            const suite = await prisma.testSuite.findUnique({ where: { id: suiteId }, select: { projectId: true } });
            return suite?.projectId || null;
        }
        return req.body?.projectId || null;
    },
    testCaseId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const testCaseId = fromRequest(req, location, key);
            if (!testCaseId) return null;
            const testCase = await prisma.testCase.findUnique({
                where: { id: testCaseId },
                select: { suite: { select: { projectId: true } } },
            });
            return testCase?.suite.projectId || null;
        };
    },
    testCaseIds: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const container = req[location] as Record<string, unknown> | undefined;
            const value = container?.[key];
            if (!Array.isArray(value) || value.length === 0) return null;

            const ids = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            if (ids.length !== value.length) return null;

            const testCases = await prisma.testCase.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    suite: {
                        select: {
                            projectId: true,
                        },
                    },
                },
            });

            if (testCases.length !== ids.length) return null;

            const projectIds = new Set(testCases.map((testCase) => testCase.suite.projectId));
            if (projectIds.size !== 1) return null;

            return testCases[0]?.suite.projectId || null;
        };
    },
    tagId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const tagId = fromRequest(req, location, key);
            if (!tagId) return null;
            const tag = await prisma.tag.findUnique({
                where: { id: tagId },
                select: { projectId: true },
            });
            return tag?.projectId || null;
        };
    },
    boardColumnId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const boardColumnId = fromRequest(req, location, key);
            if (!boardColumnId) return null;
            const boardColumn = await prisma.boardColumn.findUnique({
                where: { id: boardColumnId },
                select: { projectId: true },
            });
            return boardColumn?.projectId || null;
        };
    },
    boardColumnIds: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const container = req[location] as Record<string, unknown> | undefined;
            const value = container?.[key];
            if (!Array.isArray(value) || value.length === 0) return null;

            const ids = value
                .map((item) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>).id : null))
                .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

            if (ids.length === 0) return null;

            const uniqueIds = Array.from(new Set(ids));
            const columns = await prisma.boardColumn.findMany({
                where: { id: { in: uniqueIds } },
                select: { projectId: true },
            });

            if (columns.length !== uniqueIds.length) return null;

            const projectIds = new Set(columns.map((column) => column.projectId));
            if (projectIds.size !== 1) return null;

            return columns[0]?.projectId || null;
        };
    },
    testRunId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const runId = fromRequest(req, location, key);
            if (!runId) return null;
            const run = await prisma.testRun.findUnique({
                where: { id: runId },
                select: { projectId: true },
            });
            return run?.projectId || null;
        };
    },
    sprintId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const sprintId = fromRequest(req, location, key);
            if (!sprintId) return null;
            const sprint = await prisma.sprint.findUnique({
                where: { id: sprintId },
                select: { projectId: true },
            });
            return sprint?.projectId || null;
        };
    },
    runItemId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const runItemId = fromRequest(req, location, key);
            if (!runItemId) return null;
            const item = await prisma.testRunItem.findUnique({
                where: { id: runItemId },
                select: { testRun: { select: { projectId: true } } },
            });
            return item?.testRun.projectId || null;
        };
    },
    testResultId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const testResultId = fromRequest(req, location, key);
            if (!testResultId) return null;
            const result = await prisma.testResult.findUnique({
                where: { id: testResultId },
                select: { runItem: { select: { testRun: { select: { projectId: true } } } } },
            });
            return result?.runItem.testRun.projectId || null;
        };
    },
    workItemId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const workItemId = fromRequest(req, location, key);
            return resolveProjectIdByWorkItemId(workItemId);
        };
    },
    workItemIdCandidates: (...candidates: Array<[location: 'params' | 'body' | 'query', key: string]>): ProjectResolver => {
        return async (req) => {
            for (const [location, key] of candidates) {
                const workItemId = fromRequest(req, location, key);
                const projectId = await resolveProjectIdByWorkItemId(workItemId);
                if (projectId) return projectId;
            }
            return null;
        };
    },
    wikiSpaceId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const spaceId = fromRequest(req, location, key);
            if (!spaceId) return null;
            const space = await prisma.wikiSpace.findUnique({
                where: { id: spaceId },
                select: { projectId: true },
            });
            return space?.projectId || null;
        };
    },
    wikiPageId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const pageId = fromRequest(req, location, key);
            if (!pageId) return null;
            const page = await prisma.wikiPage.findUnique({
                where: { id: pageId },
                select: { space: { select: { projectId: true } } },
            });
            return page?.space.projectId || null;
        };
    },
    businessRequestId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const requestId = fromRequest(req, location, key);
            if (!requestId) return null;
            const businessRequest = await prisma.businessRequest.findUnique({
                where: { id: requestId },
                select: { projectId: true },
            });
            return businessRequest?.projectId || null;
        };
    },
    requirementId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const requirementId = fromRequest(req, location, key);
            if (!requirementId) return null;
            const requirement = await prisma.requirement.findUnique({
                where: { id: requirementId },
                select: { projectId: true },
            });
            return requirement?.projectId || null;
        };
    },
    automationScenarioId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const scenarioId = fromRequest(req, location, key);
            if (!scenarioId) return null;
            const scenario = await prisma.automationScenario.findUnique({
                where: { id: scenarioId },
                select: { projectId: true },
            });
            return scenario?.projectId || null;
        };
    },
    environmentId: (location: 'params' | 'body' | 'query', key: string): ProjectResolver => {
        return async (req) => {
            const environmentId = fromRequest(req, location, key);
            if (!environmentId) return null;
            const env = await prisma.environment.findUnique({
                where: { id: environmentId },
                select: { projectId: true },
            });
            return env?.projectId || null;
        };
    },
};

export const authorizeProjectPermission = (requiredPermission: string, resolveProjectId: ProjectResolver) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError('You are not logged in! Please log in to get access.', 401));
            }

            const projectId = await resolveProjectId(req);
            if (!projectId) {
                return next(new AppError('Project scope is required for this operation', 400));
            }

            const [project] = await prisma.$queryRaw<Array<{ organizationId: string | null; requireExplicitAdminMembership: boolean }>>`
                SELECT "organizationId", "requireExplicitAdminMembership" FROM "Project" WHERE id = ${projectId}
            `;
            if (!project) return next(new AppError('Project not found', 404));
            if (!req.user.organizationId || project.organizationId !== req.user.organizationId) {
                return next(new AppError('Organization boundary violation', 403));
            }

            if (req.user.role === 'ADMIN' && !project.requireExplicitAdminMembership) {
                req.projectAccessContext = { projectId, permissions: ['*'] };
                return next();
            }

            await ProjectAccess.check(projectId, req.user.id, req.user.role);
            const permissions = await resolveProjectMemberPermissions(projectId, req.user.id, req.user.role);

            req.projectAccessContext = {
                projectId,
                permissions,
            };

            if (!hasPermission(permissions, requiredPermission)) {
                return next(new AppError('You do not have permission to perform this action in this project', 403));
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
};

export const projectRoute = (
    requiredPermission: string,
    resolveProjectId: ProjectResolver,
    ...handlers: RequestHandler[]
): RequestHandler[] => [
    authorizeProjectPermission(requiredPermission, resolveProjectId),
    ...handlers,
];

export const protectedProjectRoute = (
    requiredPermission: string,
    resolveProjectId: ProjectResolver,
    ...handlers: RequestHandler[]
): RequestHandler[] => [
    protect,
    authorizeProjectPermission(requiredPermission, resolveProjectId),
    ...handlers,
];
