import { Queue } from 'bullmq';
import { connection, isRedisAvailable } from './connection';
import { monitoringTelemetryService } from '../monitoringTelemetry.service';

// Define the queue name for automation tasks
export const AUTOMATION_QUEUE_NAME = 'automation-execute';

let queue: Queue | null = null;

const getQueue = async (): Promise<Queue | null> => {
    const redisEnabled = await isRedisAvailable();
    if (!redisEnabled) {
        return null;
    }

    if (!queue) {
        queue = new Queue(AUTOMATION_QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 5000, // Start with 5s
                },
                removeOnComplete: 100,
                removeOnFail: 500,
            }
        });
    }

    return queue;
};

export const automationQueue = {
    async add(name: string, data: AutomationJobData) {
        const activeQueue = await getQueue();
        if (!activeQueue) {
            throw new Error('Automation queue is unavailable because Redis is not reachable');
        }
        try {
            const idempotencyKey = `auto:${data.testRunId}:${data.itemId}`;
            const existingJob = await activeQueue.getJob(idempotencyKey);
            if (existingJob) {
                const state = await existingJob.getState();
                if (state === 'active' || state === 'waiting' || state === 'delayed') return existingJob;
                await existingJob.remove();
            }
            const job = await activeQueue.add(name, data, {
                jobId: idempotencyKey,
            });
            monitoringTelemetryService.recordQueue({
                queueName: AUTOMATION_QUEUE_NAME,
                event: 'queued',
                jobId: job.id ?? null,
                jobName: name,
                attemptsMade: job.attemptsMade,
                data,
            });
            return job;
        } catch (error) {
            monitoringTelemetryService.recordQueue({
                queueName: AUTOMATION_QUEUE_NAME,
                event: 'enqueue_failed',
                jobName: name,
                data,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },
};

// Helper type for job payload
export interface AutomationJobData {
    testRunId: string;
    itemId: string;
    userId: string;
    role: string;
}
