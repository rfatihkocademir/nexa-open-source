import prisma from '../utils/prisma';
import { RequirementStatus, RequirementType } from '@prisma/client';
import { artifactService } from './artifact.service';
import { auditService } from './audit.service';
import { knowledgeService } from './knowledge.service';
import { AppError } from '../utils/AppError';

export class RequirementService {
    async create(data: {
        projectId: string;
        authorId: string;
        title: string;
        description?: string;
        type: RequirementType;
        sourceRequestId?: string;
    }) {
        const created = await prisma.requirement.create({
            data: {
                ...data,
                status: RequirementStatus.DRAFT,
                version: 1,
            }
        });

        // 1. Create Initial Revision
        await artifactService.createRevision({
            entityType: 'Requirement',
            entityId: created.id,
            body: created,
            authorId: data.authorId,
            status: 'PUBLISHED',
            changeReason: 'Initial requirement creation'
        });

        // 2. Sync to Traceability Node
        await prisma.traceabilityNode.create({
            data: {
                entityId: created.id,
                entityType: 'Requirement',
                title: created.title,
                status: created.status,
                projectId: created.projectId,
                metadata: { type: created.type }
            }
        });

        // 3. Audit
        await auditService.logCreate(
            { actorId: data.authorId, projectId: data.projectId },
            'Requirement',
            created.id,
            created
        );

        // 4. Index for AI
        knowledgeService.indexEntity(data.projectId, 'Requirement', created.id, `${created.title}\n${created.description || ''}`);

        return created;
    }

    async updateStatus(id: string, nextStatus: RequirementStatus, actorId: string, reason?: string) {
        const current = await prisma.requirement.findUnique({ where: { id } });
        if (!current) throw new AppError('Requirement not found', 404);

        const updated = await prisma.requirement.update({
            where: { id },
            data: { 
                status: nextStatus,
                version: { increment: 1 }
            }
        });

        // Create Revision
        await artifactService.createRevision({
            entityType: 'Requirement',
            entityId: updated.id,
            body: updated,
            authorId: actorId,
            status: 'PUBLISHED',
            changeReason: reason || `Status updated from ${current.status} to ${nextStatus}`
        });

        // Sync Traceability
        await prisma.traceabilityNode.update({
            where: { entityId: id },
            data: { status: nextStatus }
        });

        // Audit
        await auditService.logUpdate(
            { actorId, projectId: updated.projectId },
            'Requirement',
            updated.id,
            current,
            updated
        );

        return updated;
    }

    async findByProject(projectId: string) {
        return prisma.requirement.findMany({
            where: { projectId },
            include: {
                author: { select: { firstName: true, lastName: true } },
                _count: { select: { workItems: true, testCases: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findById(id: string) {
        return prisma.requirement.findUnique({
            where: { id },
            include: {
                author: { select: { firstName: true, lastName: true } },
                sourceRequest: true,
                workItems: {
                    select: { id: true, title: true, status: true, itemType: true }
                },
                testCases: {
                    select: { id: true, title: true, status: true }
                }
            }
        });
    }
}

export const requirementService = new RequirementService();
