import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { CreateProjectInput, UpdateProjectInput } from '../validations/project.validation';
import { ProjectAccess } from '../utils/projectAccess';
import { notificationService, NotificationType } from './notification.service';
import { aiAnalystService } from './ai.service';
import { knowledgeService } from './knowledge.service';
import { runInBackground } from '../utils/backgroundTask';
import { createLogger } from '../utils/logger';
import { ensureUniqueProjectKey } from '../utils/projectKey';
import { dataGovernanceService } from './data-governance.service';

const logger = createLogger('ProjectService');

export class ProjectService {
    async create(data: CreateProjectInput & { scope?: string; architecture?: string; memberIds?: string[] }, creatorId: string, organizationId: string) {
        const existingProject = await prisma.project.findFirst({
            where: { name: data.name, organizationId },
        });

        if (existingProject) {
            throw new AppError('Project with this name already exists', 400);
        }

        const primaryTeam = await prisma.team.findFirst({
            where: {
                organizationId,
                ...(data.primaryTeamId ? { id: data.primaryTeamId } : { members: { some: { userId: creatorId } } }),
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        if (data.primaryTeamId && !primaryTeam) throw new AppError('Team not found', 404);

        const project = await prisma.$transaction(async (tx) => {
            const projectKey = await ensureUniqueProjectKey(data.name, async (candidate) => {
                const existing = await (tx.project as any).findUnique({ where: { key: candidate }, select: { id: true } });
                return Boolean(existing);
            });

            // 1. Create the project
            const project = await (tx.project as any).create({
                data: {
                    key: projectKey,
                    slug: projectKey.toLowerCase(),
                    name: data.name,
                    description: data.description,
                    organizationId,
                    primaryTeamId: primaryTeam?.id,
                },
            });

            // 2. Add creator as a member
            await tx.projectMember.create({
                data: {
                    projectId: project.id,
                    userId: creatorId,
                },
            });

            // 3. Add selected team members
            if (data.memberIds && data.memberIds.length > 0) {
                const uniqueIds = [...new Set(data.memberIds.filter(id => id !== creatorId))];
                const validMembers = await tx.organizationMember.count({
                    where: { organizationId, userId: { in: uniqueIds } },
                });
                if (validMembers !== uniqueIds.length) throw new AppError('All project members must belong to the organization', 400);
                for (const memberId of uniqueIds) {
                    await tx.projectMember.create({
                        data: {
                            projectId: project.id,
                            userId: memberId,
                        },
                    });
                }
            }

            // 4. Create Documentation Wiki Space & baseline pages
            const docSpace = await tx.wikiSpace.create({
                data: {
                    name: 'Documentation',
                    description: 'Project documentation',
                    icon: 'book',
                    projectId: project.id
                }
            });

            const buildPageContent = (value: string | undefined, fallbackHtml: string): { type: 'html'; content: string } => ({
                type: 'html',
                content: value?.trim() ? value : fallbackHtml
            });

            const docSuite = data.documentationSuite || {};

            const documentationPages: Array<{ title: string; content: { type: 'html'; content: string } }> = [
                {
                    title: 'Project Purpose & Scope',
                    content: buildPageContent(
                        docSuite.scope || data.scope,
                        '<h2>Project Purpose & Scope</h2><p>Define the business problem, target users, in-scope capabilities and out-of-scope boundaries.</p>'
                    )
                },
                {
                    title: 'Architecture & Technologies',
                    content: buildPageContent(
                        docSuite.architecture || data.architecture,
                        '<h2>Architecture & Technologies</h2><p>Document system boundaries, integrations, runtime topology and core technology decisions.</p>'
                    )
                },
                {
                    title: 'Test Strategy',
                    content: buildPageContent(
                        docSuite.testStrategy,
                        '<h2>Test Strategy</h2><p>Describe quality goals, test levels, non-functional coverage, environments and entry/exit criteria.</p>'
                    )
                },
                {
                    title: 'Automation Strategy',
                    content: buildPageContent(
                        docSuite.automationStrategy,
                        '<h2>Automation Strategy</h2><p>Define automation layers, toolchain, ownership, CI/CD triggers and maintenance approach.</p>'
                    )
                },
                {
                    title: 'Release & Rollback Policy',
                    content: buildPageContent(
                        docSuite.releasePolicy,
                        '<h2>Release & Rollback Policy</h2><p>Document release cadence, quality gates, rollback triggers, communication and incident handling.</p>'
                    )
                }
            ];

            for (const [index, page] of documentationPages.entries()) {
                await tx.wikiPage.create({
                    data: {
                        key: `${projectKey}-DOC-${index + 1}`,
                        title: page.title,
                        content: page.content,
                        spaceId: docSpace.id,
                        authorId: creatorId,
                        status: 'PUBLISHED'
                    }
                });
            }

            await tx.project.update({
                where: { id: project.id },
                data: { nextWikiPageNumber: documentationPages.length + 1 },
            });


            return project;
        });

        runInBackground(() => knowledgeService.syncProjectKnowledge(project.id), (error) => {
            logger.error(`Failed to initialize knowledge for project ${project.id}`, error);
        });

        return project;
    }

    async getAll(
        userId: string,
        role: string,
        organizationId: string,
        page: number = 1,
        limit: number = 10,
        sortBy: string = 'createdAt',
        sortOrder: 'asc' | 'desc' = 'desc',
        status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
    ) {
        const restrictedProjectIds = role === 'ADMIN' || role === 'admin'
            ? (await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT p.id FROM "Project" p
                WHERE p."organizationId" = ${organizationId} AND p."requireExplicitAdminMembership" = true
                  AND NOT EXISTS (SELECT 1 FROM "ProjectMember" pm WHERE pm."projectId" = p.id AND pm."userId" = ${userId})
              `).map((project) => project.id)
            : [];
        const where: any = {
            status,
            organizationId,
            ...(role === 'ADMIN' || role === 'admin'
                ? { id: { notIn: restrictedProjectIds } }
                : { members: { some: { userId } } })
        };

        const skip = (page - 1) * limit;

        const [total, projects] = await Promise.all([
            prisma.project.count({ where }),
            prisma.project.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                include: {
                    _count: {
                        select: {
                            testRuns: true,
                            suites: { where: { deletedAt: null, parentId: null } },
                            members: true
                        },
                    },
                    testRuns: {
                        where: { status: 'OPEN' },
                        select: { id: true }
                    },
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    role: true,
                                    email: true
                                }
                            }
                        }
                    }
                },
            })
        ]);

        return {
            data: projects,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getById(id: string, userId?: string, role?: string, organizationId?: string) {
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                milestones: true,
                primaryTeam: { select: { id: true, name: true, slug: true } },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                role: true,
                                isActive: true,
                                createdAt: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        testRuns: true,
                        suites: { where: { deletedAt: null, parentId: null } }
                    },
                },
            },
        });

        if (!project) {
            throw new AppError('Project not found', 404);
        }
        if (!organizationId || project.organizationId !== organizationId) throw new AppError('Project not found', 404);

        const [security] = await prisma.$queryRaw<Array<{ dataClassification: string; requireExplicitAdminMembership: boolean }>>`
            SELECT "dataClassification"::text, "requireExplicitAdminMembership" FROM "Project" WHERE id = ${id}
        `;

        if (userId && role && (role !== 'ADMIN' || security?.requireExplicitAdminMembership)) {
            const isMember = project.members.some(m => m.userId === userId);
            if (!isMember) {
                throw new AppError('You do not have access to this project', 403);
            }
        }


        const testCaseCount = await prisma.testCase.count({
            where: {
                suite: { projectId: id },
                deletedAt: null
            }
        });

        return {
            ...project,
            ...security,
            _count: {
                ...project._count,
                testCases: testCaseCount
            }
        };
    }

    async addMember(projectId: string, identifier: string, userId: string, role: string, organizationId?: string) {
        await ProjectAccess.check(projectId, userId, role);
        const project = await this.getById(projectId, userId, role, organizationId);

        let targetUserId = identifier;

        // Check if identifier is an email
        if (identifier.includes('@')) {
            const user = await prisma.user.findUnique({
                where: { email: identifier }
            });
            if (!user) {
                throw new AppError('User not found with this email', 404);
            }
            targetUserId = user.id;
        }

        if (!organizationId) throw new AppError('Organization context is required', 403);
        const organizationMember = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: targetUserId } } });
        if (!organizationMember) throw new AppError('User does not belong to this organization', 403);

        const existingMember = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId
                }
            }
        });

        if (existingMember) {
            throw new AppError('User is already a member of this project', 400);
        }

        const member = await prisma.projectMember.create({
            data: {
                projectId,
                userId: targetUserId
            },
            include: {
                user: true
            }
        });

        // Notify the added user
        notificationService.notifyUser(targetUserId, {
            type: NotificationType.PROJECT_MEMBER_ADDED,
            title: 'Projeye Eklendiniz',
            message: `"${project.name}" projesine eklendiniz.`,
            data: { projectId, projectName: project.name }
        });

        return member;
    }

    async removeMember(projectId: string, memberId: string, userId: string, role: string, organizationId: string) {
        await ProjectAccess.check(projectId, userId, role);
        const project = await prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
        if (!project) throw new AppError('Project not found', 404);
        return prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId: memberId
                }
            }
        });
    }

    async update(id: string, data: UpdateProjectInput, userId: string, role: string, organizationId: string) {
        await ProjectAccess.check(id, userId, role);
        const currentProject = await this.getById(id, userId, role, organizationId); // Check if exists

        if (data.primaryTeamId) {
            const team = await prisma.team.findFirst({ where: { id: data.primaryTeamId, organizationId }, select: { id: true } });
            if (!team) throw new AppError('Team not found', 404);
        }

        if (data.name) {
            const existingProject = await prisma.project.findFirst({
                where: { name: data.name, organizationId, NOT: { id } },
            });

            if (existingProject) {
                throw new AppError('Project with this name already exists', 400);
            }
        }

        return prisma.$transaction(async (tx) => {
            if (data.primaryTeamId !== undefined && data.primaryTeamId !== currentProject.primaryTeamId) {
                const oldTeamSlug = currentProject.primaryTeam?.slug || 'workspace';
                await tx.resourceRouteAlias.upsert({
                    where: { oldPath: `/${oldTeamSlug}/${currentProject.slug}` },
                    update: { resourceId: id, projectId: id, resourceType: 'PROJECT' },
                    create: {
                        organizationId,
                        projectId: id,
                        resourceType: 'PROJECT',
                        resourceId: id,
                        oldPath: `/${oldTeamSlug}/${currentProject.slug}`,
                    },
                });
            }
            return tx.project.update({ where: { id }, data });
        });
    }

    async getAvailableTeams(organizationId: string) {
        return prisma.team.findMany({
            where: { organizationId },
            select: { id: true, name: true, slug: true, _count: { select: { members: true, projects: true } } },
            orderBy: { name: 'asc' },
        });
    }

    async archive(id: string, userId: string, role: string, organizationId: string) {
        await ProjectAccess.check(id, userId, role);
        await this.getById(id, userId, role, organizationId);
        return prisma.project.update({
            where: { id },
            data: { status: 'ARCHIVED' }
        });
    }

    async unarchive(id: string, userId: string, role: string, organizationId: string) {
        await ProjectAccess.check(id, userId, role);
        await this.getById(id, userId, role, organizationId);
        return prisma.project.update({
            where: { id },
            data: { status: 'ACTIVE' }
        });
    }

    async delete(id: string, userId: string, role: string, organizationId: string) {
        await ProjectAccess.check(id, userId, role);
        await this.getById(id, userId, role, organizationId); // Check if exists
        await dataGovernanceService.assertPermanentDeletionAllowed(id);

        // Check for dependencies (optional: prevent delete if has runs/suites)
        // For now, we allow delete (cascade should be handled in DB or here)

        return prisma.project.delete({
            where: { id },
        });
    }

    async getWarnings(_userId: string, role: string, organizationId?: string) {
        if (role !== 'ADMIN') return [];

        // Find projects where there are NO active users with role != ADMIN
        const projects = await prisma.project.findMany({
            where: { status: 'ACTIVE', ...(organizationId ? { organizationId } : { id: '__none__' }) },
            include: {
                members: {
                    include: {
                        user: true
                    }
                }
            }
        });

        const warnings: { projectId: string; projectName: string; type: string }[] = [];

        for (const project of projects) {
            // Count active testers (non-admin, active users)
            const activeTesterCount = project.members.filter(m =>
                m.user.isActive && (m.user.role === 'TESTER' || m.user.role === 'TEAM_LEADER')
            ).length;

            if (activeTesterCount === 0) {
                warnings.push({
                    projectId: project.id,
                    projectName: project.name,
                    type: 'NO_ACTIVE_TESTERS'
                });
            }
        }

        return warnings;
    }

    async generateQuestions(name: string, description: string, language: string) {
        return aiAnalystService.generateProjectQuestions(name, description, language);
    }

    async generateScope(name: string, description: string, qaPairs: { question: string; answer: string }[], language: string) {
        return aiAnalystService.generateProjectScope(name, description, qaPairs, language);
    }

    async generateConsolidatedWiki(name: string, description: string, scope: string, architecture: string, language: string) {
        return aiAnalystService.generateConsolidatedWiki(name, description, scope, architecture, language);
    }

    async generateDocumentationSuite(name: string, description: string, qaPairs: { question: string; answer: string }[], language: string) {
        return aiAnalystService.generateDocumentationSuite(name, description, qaPairs, language);
    }

    async generateArchitectureQuestions(name: string, description: string, scopeSummary: string, language: string) {
        return aiAnalystService.generateArchitectureQuestions(name, description, scopeSummary, language);
    }

    async generateArchitectureDocument(name: string, description: string, scopeSummary: string, qaPairs: { question: string; answer: string }[], language: string) {
        return aiAnalystService.generateArchitectureDocument(name, description, scopeSummary, qaPairs, language);
    }
}


export const projectService = new ProjectService();
