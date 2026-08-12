import { randomUUID } from 'node:crypto';
import prisma from '../utils/prisma';
import { createLogger } from '../utils/logger';
import { actionCenterService } from './action-center.service';
import { redisClient } from './queue/connection';
import { auditService } from './audit.service';

const logger = createLogger('ActionCenterReconciliation');
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const MAX_INTERVAL_MS = 60 * 60 * 1000;
const ORGANIZATION_BATCH_SIZE = 50;
const SCHEDULER_LOCK_KEY = 'nexa:action-center:reconciliation-scheduler';
const SCHEDULER_LOCK_TTL_MS = 15 * 60 * 1000;

function reconciliationInterval() {
    const configured = Number(process.env.ACTION_CENTER_RECONCILE_INTERVAL_MS);
    if (!Number.isFinite(configured)) return DEFAULT_INTERVAL_MS;
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(configured)));
}

class ActionCenterReconciliationService {
    private timer?: NodeJS.Timeout;
    private running = false;

    start() {
        if (this.timer) return;
        void this.runOnce();
        this.timer = setInterval(() => void this.runOnce(), reconciliationInterval());
        this.timer.unref();
        logger.info('Automatic risk reconciliation scheduled');
    }

    stop() {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = undefined;
    }

    async runOnce() {
        if (this.running) {
            logger.warn('Skipping overlapping risk reconciliation cycle');
            return { organizations: 0, detected: 0, skipped: true };
        }

        this.running = true;
        const lockOwner = randomUUID();
        let distributedLock: boolean | null = null;
        let heartbeat: NodeJS.Timeout | undefined;
        let cursor: string | undefined;
        let organizations = 0;
        let detected = 0;
        try {
            distributedLock = await redisClient.acquireLock(SCHEDULER_LOCK_KEY, lockOwner, SCHEDULER_LOCK_TTL_MS);
            if (distributedLock === false) {
                logger.info('Another instance owns the automatic risk reconciliation cycle');
                return { organizations: 0, detected: 0, skipped: true };
            }
            if (distributedLock) {
                heartbeat = setInterval(
                    () => void redisClient.renewLock(SCHEDULER_LOCK_KEY, lockOwner, SCHEDULER_LOCK_TTL_MS),
                    SCHEDULER_LOCK_TTL_MS / 3,
                );
                heartbeat.unref();
            } else {
                logger.warn('Redis is unavailable; reconciliation is protected only within this process');
            }

            do {
                const batch = await prisma.organization.findMany({
                    orderBy: { id: 'asc' },
                    take: ORGANIZATION_BATCH_SIZE,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                    select: {
                        id: true,
                        members: {
                            where: { user: { isActive: true, deletedAt: null } },
                            orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
                            take: 1,
                            select: { userId: true },
                        },
                    },
                });

                for (const organization of batch) {
                    const systemActorId = organization.members[0]?.userId;
                    if (!systemActorId) continue;
                    try {
                        const result = await actionCenterService.reconcile({
                            userId: systemActorId,
                            organizationId: organization.id,
                            role: 'ADMIN',
                        });
                        organizations += 1;
                        detected += result.reconciliation.detected;
                        if (result.reconciliation.created > 0 || result.reconciliation.autoResolved > 0 || result.reconciliation.reopened > 0) {
                            await auditService.log({
                                context: { actorId: 'system', organizationId: organization.id },
                                entityType: 'ActionCenter',
                                entityId: organization.id,
                                action: 'ACTION_CENTER_SYSTEM_RECONCILE',
                                after: result.reconciliation,
                            }, false);
                        }
                    } catch (error) {
                        logger.error(`Risk reconciliation failed for organization ${organization.id}`, error);
                    }
                }

                cursor = batch.length === ORGANIZATION_BATCH_SIZE ? batch[batch.length - 1]?.id : undefined;
            } while (cursor);

            logger.info(`Risk reconciliation completed for ${organizations} organization(s); ${detected} active signal(s) detected`);
            return { organizations, detected, skipped: false };
        } catch (error) {
            logger.error('Automatic risk reconciliation cycle failed', error);
            return { organizations, detected, skipped: false };
        } finally {
            if (heartbeat) clearInterval(heartbeat);
            if (distributedLock) await redisClient.releaseLock(SCHEDULER_LOCK_KEY, lockOwner);
            this.running = false;
        }
    }
}

export const actionCenterReconciliationService = new ActionCenterReconciliationService();
