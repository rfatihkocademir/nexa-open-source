import { Queue } from 'bullmq';
import { connection, isRedisAvailable } from './connection';
import { monitoringTelemetryService } from '../monitoringTelemetry.service';

export const BUG_REPORTING_QUEUE_NAME = 'bug-reporting';

export interface BugReportingJobData {
    testResultId: string;
    projectId: string;
    runItemId: string;
}

let queue: Queue<BugReportingJobData> | null = null;

const getQueue = async (): Promise<Queue<BugReportingJobData> | null> => {
    const redisEnabled = await isRedisAvailable();
    if (!redisEnabled) {
        return null;
    }

    if (!queue) {
        queue = new Queue<BugReportingJobData>(BUG_REPORTING_QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        });
    }

    return queue;
};

export const bugReportingQueue = {
    async add(name: string, data: BugReportingJobData) {
        const activeQueue = await getQueue();
        if (!activeQueue) {
            throw new Error('Bug reporting queue is unavailable because Redis is not reachable');
        }
        try {
            const job = await activeQueue.add(name, data);
            monitoringTelemetryService.recordQueue({
                queueName: BUG_REPORTING_QUEUE_NAME,
                event: 'queued',
                jobId: job.id ?? null,
                jobName: name,
                attemptsMade: job.attemptsMade,
                data,
            });
            return job;
        } catch (error) {
            monitoringTelemetryService.recordQueue({
                queueName: BUG_REPORTING_QUEUE_NAME,
                event: 'enqueue_failed',
                jobName: name,
                data,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },
};
