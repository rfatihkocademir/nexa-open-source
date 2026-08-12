import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

export class CleanupService {
    private isRunning = false;
    private timer?: NodeJS.Timeout;

    private retentionDays() {
        const configured = Number(process.env.SOFT_DELETE_RETENTION_DAYS || 90);
        return Number.isInteger(configured) && configured >= 30 ? configured : 90;
    }

    async performHardDeleteCleanup() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            const retentionDays = this.retentionDays();
            const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
            logger.info(`[CleanupService] Legal hold korumalı kalıcı temizleme başlatıldı (${retentionDays} gün).`);
            const eligibleProjects = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT p.id FROM "Project" p
                WHERE NOT EXISTS (
                    SELECT 1 FROM "LegalHold" h
                    WHERE h.status = 'ACTIVE'::"LegalHoldStatus"
                      AND h."organizationId" = p."organizationId"
                      AND (h."projectId" IS NULL OR h."projectId" = p.id)
                )
            `;
            let totalDeleted = 0;
            for (const project of eligibleProjects) {
                const results = await prisma.$transaction([
                    prisma.workItem.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.wikiPage.deleteMany({ where: { space: { projectId: project.id }, deletedAt: { lt: cutoff } } }),
                    prisma.wikiSpace.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.testCase.deleteMany({ where: { suite: { projectId: project.id }, deletedAt: { lt: cutoff } } }),
                    prisma.testSuite.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.testRun.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.milestone.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.releaseCandidate.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.tag.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                    prisma.automationScenario.deleteMany({ where: { projectId: project.id, deletedAt: { lt: cutoff } } }),
                ]);
                totalDeleted += results.reduce((sum, result) => sum + result.count, 0);
            }
            
            if (totalDeleted > 0) {
                logger.info(`[CleanupService] Successfully hard deleted ${totalDeleted} records.`);
            } else {
                logger.info('[CleanupService] No records found for hard deletion.');
            }
        } catch (error) {
            logger.error('[CleanupService] Failed to perform cleanup', error);
        } finally {
            this.isRunning = false;
        }
    }

    startCleanupJob() {
        if (process.env.ENABLE_RETENTION_PURGE !== 'true') {
            logger.warn('[CleanupService] Kalıcı temizleme kapalı. Etkinleştirmek için ENABLE_RETENTION_PURGE=true ayarlayın.');
            return;
        }
        if (this.timer) return;
        void this.performHardDeleteCleanup();
        this.timer = setInterval(() => void this.performHardDeleteCleanup(), 24 * 60 * 60 * 1000);
        this.timer.unref();
    }

    stopCleanupJob() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}

export const cleanupService = new CleanupService();
