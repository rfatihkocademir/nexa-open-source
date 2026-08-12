import { ImpactStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { notificationService, NotificationType } from './notification.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ImpactAnalysisService');

export class ImpactAnalysisService {
    /**
     * Analyzes changes in a Requirement and flags linked WorkItems.
     */
    async analyzeRequirementChange(requirementId: string) {
        logger.info(`Analyzing impact for Requirement ${requirementId}`);

        const linkedItems = await prisma.workItem.findMany({
            where: { requirementId, impactStatus: 'CLEAN' }
        });

        for (const item of linkedItems) {
            await this.flagWorkItemImpact(item.id, `Parent Requirement was updated.`);
        }
    }

    /**
     * Flags a WorkItem as impacted and propagates recursively.
     */
    async flagWorkItemImpact(workItemId: string, reason: string) {
        const item = await prisma.workItem.findUnique({
            where: { id: workItemId },
            select: { id: true, title: true, itemType: true, projectId: true, assigneeId: true }
        });

        if (!item) return;

        await prisma.workItem.update({
            where: { id: workItemId },
            data: {
                impactStatus: ImpactStatus.IMPACTED,
                impactReason: reason
            }
        });

        if (item.assigneeId) {
            await notificationService.notifyUser(item.assigneeId, {
                type: NotificationType.WARNING,
                title: 'Impact Detected',
                message: `Item "${item.title}" is impacted: ${reason}`,
                data: { workItemId: item.id, projectId: item.projectId }
            });
        }

        // Propagate to Children
        const children = await prisma.workItem.findMany({
            where: { parentId: workItemId, impactStatus: 'CLEAN' }
        });

        for (const child of children) {
            await this.flagWorkItemImpact(child.id, `Upstream ${item.itemType} "${item.title}" was updated.`);
        }

        // Propagate to Test Cases
        const testCases = await prisma.testCase.findMany({
            where: { workItemId: item.id, impactStatus: 'CLEAN' }
        });

        for (const tc of testCases) {
            await prisma.testCase.update({
                where: { id: tc.id },
                data: {
                    impactStatus: ImpactStatus.STALE,
                    impactReason: `Linked ${item.itemType} "${item.title}" was updated.`
                }
            });

            await notificationService.notifyUser(tc.authorId, {
                type: NotificationType.WARNING,
                title: 'Test Case Stale',
                message: `Test Case "${tc.title}" might be stale due to upstream changes.`,
                data: { testCaseId: tc.id, projectId: item.projectId }
            });
        }
    }

    /**
     * legacy entry point for WorkItem changes
     */
    async analyzeWorkItemChange(workItemId: string, _actorId: string, changes: { description?: boolean; title?: boolean }) {
        if (!changes.description && !changes.title) return;
        await this.flagWorkItemImpact(workItemId, 'Self-update detected.');
    }

    /**
     * Analyzes changes in a Wiki Page and flags linked WorkItems.
     */
    async analyzeWikiPageChange(pageId: string, _actorId: string) {
        const page = await prisma.wikiPage.findUnique({
            where: { id: pageId },
            include: { space: true }
        });

        if (!page) return;

        logger.info(`Analyzing impact for WikiPage ${pageId} (${page.title})`);

        // Find linked WorkItems
        const linkedWorkItems = await prisma.workItem.findMany({
            where: { documentationPageId: pageId, impactStatus: 'CLEAN' }
        });

        for (const item of linkedWorkItems) {
            await this.flagWorkItemImpact(item.id, `Linked Wiki Page "${page.title}" was updated.`);
        }
    }

    async clearImpact(entityType: 'WorkItem' | 'TestCase' | 'WikiPage', entityId: string) {
        if (entityType === 'WorkItem') {
            await prisma.workItem.update({ where: { id: entityId }, data: { impactStatus: ImpactStatus.CLEAN, impactReason: null } });
        } else if (entityType === 'TestCase') {
            await prisma.testCase.update({ where: { id: entityId }, data: { impactStatus: ImpactStatus.CLEAN, impactReason: null } });
        } else if (entityType === 'WikiPage') {
            await prisma.wikiPage.update({ where: { id: entityId }, data: { impactStatus: ImpactStatus.CLEAN, impactReason: null } });
        }
    }
}

export const impactAnalysisService = new ImpactAnalysisService();
