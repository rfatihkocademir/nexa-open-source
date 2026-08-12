import { Queue } from 'bullmq';
import { connection, isRedisAvailable } from './connection';
import { monitoringTelemetryService } from '../monitoringTelemetry.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AIQueue');

export const AI_QUEUE_NAME = 'ai-generate';

const AI_QUEUE_ATTEMPTS = Math.max(1, Number(process.env.AI_QUEUE_ATTEMPTS || 2));

let queue: Queue | null = null;

const getQueue = async (): Promise<Queue | null> => {
    const redisEnabled = await isRedisAvailable();
    if (!redisEnabled) {
        return null;
    }

    if (!queue) {
        queue = new Queue(AI_QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                attempts: AI_QUEUE_ATTEMPTS,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: 100,
                removeOnFail: 500,
            }
        });
    }

    return queue;
};

/**
 * Generates a deterministic idempotency key for the job to prevent duplicate processing.
 */
function getIdempotencyKey(data: AIJobData): string {
    switch (data.type) {
        case 'generate-epics':
            return `ai-epics-${data.projectId}-${data.userId}`;
        case 'generate-testcases':
            // A story has one canonical generation stream. Including the requester
            // here allowed two users to create duplicate cases concurrently.
            return `ai-testcases-${data.storyId}`;
        case 'analyze-business-request':
            return `ai-analyze-${data.requestId}`;
        default:
            return `ai-${Date.now()}`;
    }
}

export const aiQueue = {
    async add(name: string, data: AIJobData) {
        const activeQueue = await getQueue();
        if (!activeQueue) {
            throw new Error('AI queue is unavailable because Redis is not reachable');
        }
        try {
            const idempotencyKey = getIdempotencyKey(data);
            
            // Gracefully handle duplicate requests: check if job already exists and is active/waiting
            const existingJob = await activeQueue.getJob(idempotencyKey);
            if (existingJob) {
                const status = await existingJob.getState();
                if (status === 'active' || status === 'waiting' || status === 'delayed') {
                    logger.debug(`Found existing active/waiting job ${idempotencyKey}, returning it.`);
                    return existingJob;
                }
                // If it failed or was removed, we might want to clean it up or overwrite
                await existingJob.remove();
            }

            const job = await activeQueue.add(name, data, {
                jobId: idempotencyKey,
            });
            monitoringTelemetryService.recordQueue({
                queueName: AI_QUEUE_NAME,
                event: 'queued',
                jobId: job.id ?? null,
                jobName: name,
                attemptsMade: job.attemptsMade,
                data,
            });
            return job;
        } catch (error) {
            monitoringTelemetryService.recordQueue({
                queueName: AI_QUEUE_NAME,
                event: 'enqueue_failed',
                jobName: name,
                data,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },
};

// Job Data Interfaces
export interface AIEpicsJobData {
    type: 'generate-epics';
    projectId: string;
    requirementText: string;
    language: string;
    userId: string;
}

export interface AITestCasesJobData {
    type: 'generate-testcases';
    storyId: string;
    projectId: string;
    language: string;
    userId: string;
}

export interface AIBusinessRequestAnalysisJobData {
    type: 'analyze-business-request';
    requestId: string;
    projectId: string;
    language: string;
    userId: string;
}

export type AIJobData = AIEpicsJobData | AITestCasesJobData | AIBusinessRequestAnalysisJobData;
