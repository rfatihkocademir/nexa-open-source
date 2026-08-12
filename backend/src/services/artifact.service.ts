import { ArtifactStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { assertArtifactLifecycleTransition, type ArtifactLifecycleStatus } from '../utils/stateMachine';
import { auditService } from './audit.service';

export interface CreateRevisionInput {
  entityType: string;
  entityId: string;
  body: any;
  authorId: string;
  changeReason?: string;
  status?: ArtifactStatus;
  isAIGenerated?: boolean;
}

export class ArtifactService {
  async createRevision(input: CreateRevisionInput) {
    const lastRevision = await prisma.artifactRevision.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = lastRevision ? lastRevision.version + 1 : 1;

    // When a new version is published, the old one should be superseded
    if (input.status === 'PUBLISHED' || input.status === 'APPROVED') {
      await prisma.artifactRevision.updateMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        data: { status: 'SUPERSEDED' },
      });
    }

    return prisma.artifactRevision.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        version: nextVersion,
        body: input.body,
        changeReason: input.changeReason || null,
        status: input.status || 'DRAFT',
        authorId: input.authorId,
      },
    });
  }

  async getLatestPublished(entityType: string, entityId: string) {
    return prisma.artifactRevision.findFirst({
      where: {
        entityType,
        entityId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });
  }

  async getLatestDraft(entityType: string, entityId: string) {
    return prisma.artifactRevision.findFirst({
      where: {
        entityType,
        entityId,
        status: 'DRAFT',
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });
  }

  async getHistory(entityType: string, entityId: string) {
    return prisma.artifactRevision.findMany({
      where: {
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
  }

  /**
   * DRAFT → IN_REVIEW: Submit artifact for review.
   */
  async requestReview(revisionId: string, actorId: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    assertArtifactLifecycleTransition(revision.status as ArtifactLifecycleStatus, 'IN_REVIEW');

    const updated = await prisma.artifactRevision.update({
      where: { id: revisionId },
      data: { status: 'IN_REVIEW' },
    });

    await auditService.logUpdate(
      { actorId },
      'ArtifactRevision',
      revisionId,
      { status: revision.status },
      { status: 'IN_REVIEW' }
    );

    return updated;
  }

  /**
   * IN_REVIEW → APPROVED: Approve the artifact.
   */
  async approve(revisionId: string, actorId: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    assertArtifactLifecycleTransition(revision.status as ArtifactLifecycleStatus, 'APPROVED');

    const updated = await prisma.artifactRevision.update({
      where: { id: revisionId },
      data: { status: 'APPROVED' },
    });

    await auditService.logUpdate(
      { actorId },
      'ArtifactRevision',
      revisionId,
      { status: revision.status },
      { status: 'APPROVED' }
    );

    return updated;
  }

  /**
   * IN_REVIEW → DRAFT: Request revision (reason mandatory).
   */
  async requestRevision(revisionId: string, actorId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('Revision reason is required when requesting changes.', 400);
    }

    const revision = await this.getRevisionOrThrow(revisionId);
    assertArtifactLifecycleTransition(revision.status as ArtifactLifecycleStatus, 'DRAFT');

    const updated = await prisma.artifactRevision.update({
      where: { id: revisionId },
      data: {
        status: 'DRAFT',
        changeReason: reason,
      },
    });

    await auditService.logUpdate(
      { actorId },
      'ArtifactRevision',
      revisionId,
      { status: revision.status },
      { status: 'DRAFT', changeReason: reason },
      reason
    );

    return updated;
  }

  /**
   * APPROVED → PUBLISHED: Promote artifact to published state.
   * Supersedes any previously published version.
   */
  async promoteToPublished(revisionId: string, actorId: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    assertArtifactLifecycleTransition(revision.status as ArtifactLifecycleStatus, 'PUBLISHED');

    // Supersede old published version
    await prisma.artifactRevision.updateMany({
      where: {
        entityType: revision.entityType,
        entityId: revision.entityId,
        status: 'PUBLISHED',
      },
      data: { status: 'SUPERSEDED' },
    });

    const updated = await prisma.artifactRevision.update({
      where: { id: revisionId },
      data: { status: 'PUBLISHED' },
    });

    await auditService.logUpdate(
      { actorId },
      'ArtifactRevision',
      revisionId,
      { status: revision.status },
      { status: 'PUBLISHED' }
    );

    return updated;
  }

  /**
   * PUBLISHED/SUPERSEDED → ARCHIVED: Archive the artifact.
   */
  async archive(revisionId: string, actorId: string) {
    const revision = await this.getRevisionOrThrow(revisionId);
    // Allow archiving from PUBLISHED or SUPERSEDED
    if (revision.status !== 'PUBLISHED' && revision.status !== 'SUPERSEDED') {
      throw new AppError(`Cannot archive artifact in ${revision.status} state. Only PUBLISHED or SUPERSEDED artifacts can be archived.`, 400);
    }

    const updated = await prisma.artifactRevision.update({
      where: { id: revisionId },
      data: { status: 'ARCHIVED' },
    });

    await auditService.logUpdate(
      { actorId },
      'ArtifactRevision',
      revisionId,
      { status: revision.status },
      { status: 'ARCHIVED' }
    );

    return updated;
  }

  async hardDelete(revisionId: string) {
    const revision = await prisma.artifactRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new AppError('Revision not found', 404);
    
    return prisma.artifactRevision.delete({
      where: { id: revisionId }
    });
  }

  private async getRevisionOrThrow(revisionId: string) {
    const revision = await prisma.artifactRevision.findFirst({
      where: { id: revisionId, deletedAt: null }
    });

    if (!revision) {
      throw new AppError('Revision not found', 404);
    }

    return revision;
  }
}

export const artifactService = new ArtifactService();

