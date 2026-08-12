import { Worker, Job } from 'bullmq';
import { ResultStatus } from '@prisma/client';
import { connection, isRedisAvailable } from '../services/queue/connection';
import { AUTOMATION_QUEUE_NAME, AutomationJobData } from '../services/queue/automation.queue';
import { testRunExecutionService } from '../services/testRunExecution.service';
import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';
import prisma from '../utils/prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('AutomationWorker');

export const initAutomationWorker = () => {
    logger.info('Initializing automation execution worker...');

    const startWorkerPromise = (async () => {
        const redisEnabled = await isRedisAvailable();
        if (!redisEnabled) {
            logger.warn('Automation worker disabled because Redis is unavailable');
            return { close: async () => undefined };
        }

        const worker = new Worker<AutomationJobData>(
            AUTOMATION_QUEUE_NAME,
            async (job: Job) => {
                const { itemId, userId, role } = job.data;
                logger.info(`Started processing job ${job.id} for item ${itemId}`);

                try {
                    await testRunExecutionService.executeItemAutomationInternal(itemId, userId, role);
                    logger.info(`Completed job ${job.id} successfully`);
                    return { status: 'success', itemId };
                } catch (error: any) {
                    logger.error(`Failed job ${job.id}:`, error);

                    await prisma.testRunItem.update({
                        where: { id: itemId },
                        data: {
                            automationStatus: ResultStatus.FAIL,
                            automationExecutedAt: new Date(),
                            finalStatus: ResultStatus.FAIL,
                        }
                    });

                    throw error;
                }
            },
            {
                connection,
                concurrency: process.env.WORKER_CONCURRENCY ? parseInt(process.env.WORKER_CONCURRENCY) : 2
            }
        );

        worker.on('active', (job) => {
            monitoringTelemetryService.recordQueue({
                queueName: AUTOMATION_QUEUE_NAME,
                event: 'active',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: job.data,
            });
        });

        worker.on('completed', (job, result) => {
            monitoringTelemetryService.recordQueue({
                queueName: AUTOMATION_QUEUE_NAME,
                event: 'completed',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: result,
            });
        });

        worker.on('failed', (job, err) => {
            logger.error(`Job ${job?.id} failed with error ${err.message}`);
            monitoringTelemetryService.recordQueue({
                queueName: AUTOMATION_QUEUE_NAME,
                event: 'failed',
                jobId: job?.id ?? null,
                jobName: job?.name ?? null,
                attemptsMade: job?.attemptsMade ?? null,
                data: job?.data,
                error: err.message,
            });
        });

        worker.on('error', (err) => {
            logger.error('Fatal error:', err);
        });

        return worker;
    })();

    return {
        close: async () => {
            const worker = await startWorkerPromise;
            await worker.close();
        },
    };
};
