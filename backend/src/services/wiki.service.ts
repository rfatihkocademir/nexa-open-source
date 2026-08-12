import { knowledgeService } from './knowledge.service';
import { normalizeWikiContent } from './ai.service';
import { artifactService } from './artifact.service';
import { impactAnalysisService } from './impactAnalysis.service';
import { auditService } from './audit.service';
import prisma from '../utils/prisma';
import { dataGovernanceService } from './data-governance.service';
import { AppError } from '../utils/AppError';

export class WikiService {
    async getSpaces(projectId: string, includeDeleted: boolean = false) {
        const where: any = { projectId };
        if (!includeDeleted) {
            where.deletedAt = null;
        }
        return prisma.wikiSpace.findMany({
            where,
            include: {
                _count: { 
                    select: { 
                        pages: { where: { deletedAt: null } } 
                    } 
                }
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    async createSpace(projectId: string, data: { name: string; description?: string; icon?: string }) {
        return prisma.wikiSpace.create({
            data: {
                ...data,
                projectId
            }
        });
    }

    async updateSpace(spaceId: string, data: { name?: string; description?: string; icon?: string }) {
        return prisma.wikiSpace.update({
            where: { id: spaceId },
            data: { ...data, updatedAt: new Date() }
        });
    }

    async archiveSpace(spaceId: string, userId: string) {
        const space = await prisma.wikiSpace.findUnique({
            where: { id: spaceId },
            include: { pages: { where: { deletedAt: null } } }
        });
        if (!space) return null;

        const result = await prisma.wikiSpace.update({
            where: { id: spaceId },
            data: { deletedAt: new Date() }
        });

        // Also soft delete all pages in this space
        await prisma.wikiPage.updateMany({
            where: { spaceId, deletedAt: null },
            data: { deletedAt: new Date() }
        });

        for (const page of space.pages) {
            await knowledgeService.removeEntity('WikiPage', page.id);
        }

        await auditService.logUpdate(
            { actorId: userId, projectId: space.projectId },
            'WikiSpace',
            spaceId,
            { archived: false },
            { archived: true }
        );

        return result;
    }

    async deleteSpace(spaceId: string, userId: string) {
        return this.archiveSpace(spaceId, userId);
    }

    async restoreSpace(spaceId: string, userId: string) {
        const space = await prisma.wikiSpace.update({
            where: { id: spaceId },
            data: { deletedAt: null }
        });

        // Restore pages as well? Usually yes if they were deleted at the same time
        // But for simplicity and safety, we just restore the space. 
        // If we want to restore pages, we'd need to know which ones were deleted because of the space.
        
        await auditService.logUpdate(
            { actorId: userId, projectId: space.projectId },
            'WikiSpace',
            spaceId,
            { archived: true },
            { archived: false }
        );

        return space;
    }

    async hardDeleteSpace(spaceId: string, userId: string) {
        const space = await prisma.wikiSpace.findUnique({
            where: { id: spaceId },
            include: { pages: true }
        });
        if (!space) return null;
        await dataGovernanceService.assertPermanentDeletionAllowed(space.projectId);

        for (const page of space.pages) {
            await knowledgeService.removeEntity('WikiPage', page.id);
        }

        const result = await prisma.wikiSpace.delete({
            where: { id: spaceId }
        });

        await auditService.logDelete(
            { actorId: userId, projectId: space.projectId },
            'WikiSpace',
            spaceId,
            space
        );

        return result;
    }

    async getPageTree(spaceId: string, includeDeleted: boolean = false) {
        const where: any = { spaceId };
        if (!includeDeleted) {
            where.deletedAt = null;
        }
        const pages = await prisma.wikiPage.findMany({
            where,
            select: {
                id: true,
                key: true,
                title: true,
                parentId: true,
                updatedAt: true,
                version: true,
                deletedAt: true
            },
            orderBy: { title: 'asc' }
        });

        return this.buildTree(pages);
    }

    async getPage(pageId: string) {
        return prisma.wikiPage.findFirst({
            where: { id: pageId, deletedAt: null },
            include: {
                author: { select: { id: true, firstName: true, lastName: true, email: true } },
                parent: { select: { id: true, title: true } }
            }
        });
    }

    async createPage(authorId: string, data: { spaceId: string; title: string; content?: any; parentId?: string }) {
        const page = await prisma.$transaction(async (tx) => {
            const space = await tx.wikiSpace.findUnique({
                where: { id: data.spaceId },
                select: { project: { select: { id: true, key: true } } },
            });
            if (!space) throw new AppError('Wiki space not found', 404);
            const project = await tx.project.update({
                where: { id: space.project.id },
                data: { nextWikiPageNumber: { increment: 1 } },
                select: { nextWikiPageNumber: true },
            });
            return tx.wikiPage.create({
                data: {
                    ...data,
                    key: `${space.project.key}-DOC-${project.nextWikiPageNumber - 1}`,
                    authorId,
                    version: 1,
                    status: 'DRAFT'
                },
                include: { space: true }
            });
        });

        await artifactService.createRevision({
            entityType: 'WikiPage',
            entityId: page.id,
            body: page,
            authorId,
            status: 'PUBLISHED'
        });

        await auditService.logCreate(
            { actorId: authorId, projectId: (page as any).space.projectId },
            'WikiPage',
            page.id,
            page
        );

        // STOP: Auto-indexing removed. Pages must be APPROVED to enter knowledge base.
        
        return page;
    }

    async updatePage(pageId: string, userId: string, data: { title?: string; content?: any }) {
        const before = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });

        const page = await prisma.wikiPage.update({
            where: { id: pageId },
            data: {
                ...data,
                version: { increment: 1 }
            },
            include: { space: true }
        });

        await artifactService.createRevision({
            entityType: 'WikiPage',
            entityId: page.id,
            body: page,
            authorId: userId,
            status: 'DRAFT'
        });

        await auditService.logUpdate(
            { actorId: userId, projectId: (page as any).space.projectId },
            'WikiPage',
            page.id,
            before,
            page
        );

        await impactAnalysisService.analyzeWikiPageChange(page.id, userId);

        // STOP: Auto-indexing removed. Updates to unapproved or previously approved pages
        // do not automatically refresh the index. Status transition to APPROVED is required.

        return page;
    }

    async archivePage(pageId: string, userId: string) {
        const existing = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });
        if (!existing) return null;

        const result = await prisma.wikiPage.update({
            where: { id: pageId },
            data: { deletedAt: new Date() }
        });

        await knowledgeService.removeEntity('WikiPage', pageId);

        await auditService.logUpdate(
            { actorId: userId, projectId: existing.space.projectId },
            'WikiPage',
            pageId,
            { archived: false },
            { archived: true }
        );

        return result;
    }

    async restorePage(pageId: string, userId: string) {
        const existing = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });
        if (!existing) return null;

        const result = await prisma.wikiPage.update({
            where: { id: pageId },
            data: { deletedAt: null }
        });

        await auditService.logUpdate(
            { actorId: userId, projectId: existing.space.projectId },
            'WikiPage',
            pageId,
            { archived: true },
            { archived: false }
        );

        return result;
    }

    async hardDeletePage(pageId: string, userId: string) {
        const existing = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });
        if (!existing) return null;
        await dataGovernanceService.assertPermanentDeletionAllowed(existing.space.projectId);

        await knowledgeService.removeEntity('WikiPage', pageId);

        const result = await prisma.wikiPage.delete({
            where: { id: pageId }
        });

        await auditService.logDelete(
            { actorId: userId, projectId: existing.space.projectId },
            'WikiPage',
            pageId,
            existing
        );

        return result;
    }

    async deletePage(pageId: string, userId?: string) {
        return this.archivePage(pageId, userId || 'system');
    }

    async syncAll(projectId: string) {
        const pages = await prisma.wikiPage.findMany({
            where: { 
                space: { projectId },
                status: { in: ['APPROVED', 'PUBLISHED'] }
            },
            include: { space: true }
        });
        for (const page of pages) {
            const plainText = normalizeWikiContent(page.content);
            await knowledgeService.indexEntity(projectId, 'WikiPage', page.id, `${page.title}\n${plainText}`);
        }
    }

    async updateStatus(pageId: string, userId: string, status: any) {
        const page = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });

        if (!page) return null;

        const updated = await prisma.wikiPage.update({
            where: { id: pageId },
            data: { status, updatedAt: new Date() },
            include: { space: true }
        });

        // Authoritative Indexing Gate
        if (status === 'APPROVED' || status === 'PUBLISHED') {
            const plainText = normalizeWikiContent(updated.content);
            await knowledgeService.indexEntity((updated as any).space.projectId, 'WikiPage', updated.id, `${updated.title}\n${plainText}`);
        } else {
            // Remove from knowledge base if transitioned away from APPROVED/PUBLISHED
            await knowledgeService.removeEntity('WikiPage', updated.id);
        }

        await auditService.logUpdate(
            { actorId: userId, projectId: (updated as any).space.projectId },
            'WikiPage',
            updated.id,
            { status: (page as any).status },
            updated
        );

        return updated;
    }

    private buildTree(pages: any[]) {
        const map = new Map();
        const roots: any[] = [];

        pages.forEach(page => {
            map.set(page.id, { ...page, children: [] });
        });

        pages.forEach(page => {
            if (page.parentId) {
                const parent = map.get(page.parentId);
                if (parent) {
                    parent.children.push(map.get(page.id));
                } else {
                    // Parent might be deleted or not fetched? Treat as root for safety
                    roots.push(map.get(page.id));
                }
            } else {
                roots.push(map.get(page.id));
            }
        });

        return roots;
    }
}

export const wikiService = new WikiService();
