import { Worker, Job } from 'bullmq';
import { connection } from '../services/queue/connection';
import { isRedisAvailable } from '../services/queue/connection';
import { AI_QUEUE_NAME, AIJobData } from '../services/queue/ai.queue';
import { aiAnalystService } from '../services/ai.service';
import { notificationService, NotificationType } from '../services/notification.service';
import { businessRequestService } from '../services/business-request.service';
import type { AIJobStatus } from '../types/aiJob';
import { getAIJob, setAIJob } from '../services/aiJobStorage.service';
import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('AIWorker');

function buildAIJobUpdate(
    current: unknown,
    patch: Partial<AIJobStatus> & Pick<AIJobStatus, 'kind' | 'status'>
): AIJobStatus {
    const base = (current && typeof current === 'object' ? current : {}) as Partial<AIJobStatus>;
    return {
        ...base,
        ...patch,
    };
}

async function updateBusinessRequestJob(requestId: string, patch: Partial<AIJobStatus> & Pick<AIJobStatus, 'kind' | 'status'>) {
    const existing = await getAIJob('BusinessRequest', requestId);
    await setAIJob('BusinessRequest', requestId, buildAIJobUpdate(existing, patch));
}

async function updateStoryJob(storyId: string, patch: Partial<AIJobStatus> & Pick<AIJobStatus, 'kind' | 'status'>) {
    const existing = await getAIJob('WorkItem', storyId);
    await setAIJob('WorkItem', storyId, buildAIJobUpdate(existing, patch));
}

export const initAIWorker = () => {
    logger.info('Initializing AI generation worker...');
    const startWorkerPromise = (async () => {
        const redisEnabled = await isRedisAvailable();
        if (!redisEnabled) {
            logger.warn('AI worker disabled because Redis is unavailable');
            return { close: async () => undefined };
        }

        const worker = new Worker<AIJobData>(
            AI_QUEUE_NAME,
            async (job: Job) => {
                const data = job.data;
                logger.info(`Started AI job ${job.id} of type ${data.type}`);

                try {
                    if (data.type === 'generate-epics') {
                        const analysis = await aiAnalystService.analyzeRequirement(
                            data.requirementText,
                            data.language
                        );

                        if (analysis.status === 'COMPLETE' && (analysis.epics?.length ?? 0) > 0) {
                            await aiAnalystService.createBatch(
                                data.projectId,
                                { epics: analysis.epics || [] },
                                data.userId
                            );

                            await notificationService.notifyUser(data.userId, {
                                type: NotificationType.INFO,
                                title: 'AI Analysis Complete',
                                message: `Generated Epics and Stories from your requirement.`,
                                data: { projectId: data.projectId, type: 'epics-generated' }
                            });
                        } else if (analysis.status === 'NEEDS_INFO') {
                            await notificationService.notifyUser(data.userId, {
                                type: NotificationType.INFO,
                                title: 'AI Needs Clarification',
                                message: `The AI requires more information to proceed. Check the board.`,
                                data: { questions: analysis.questions, type: 'needs-info', projectId: data.projectId }
                            });
                        }
                    }
                    else if (data.type === 'analyze-business-request') {
                        await updateBusinessRequestJob(data.requestId, {
                            kind: 'BUSINESS_REQUEST_ANALYSIS',
                            status: 'RUNNING',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            startedAt: new Date().toISOString(),
                            error: null,
                        });

                        const analyzedRequest = await businessRequestService.analyze(data.requestId, data.language);
                        const aiAnalysis = analyzedRequest.aiAnalysis as { status?: string } | null | undefined;
                        const analysisStatus = aiAnalysis?.status === 'NEEDS_INFO'
                            ? 'business-request-needs-info'
                            : 'business-request-analyzed';

                        await updateBusinessRequestJob(data.requestId, {
                            kind: 'BUSINESS_REQUEST_ANALYSIS',
                            status: 'COMPLETED',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            finishedAt: new Date().toISOString(),
                            error: null,
                            resultSummary: aiAnalysis?.status === 'NEEDS_INFO'
                                ? `needs_info:${aiAnalysis?.status ?? 'unknown'}`
                                : 'analysis_completed',
                        });

                        await notificationService.notifyUser(data.userId, {
                            type: NotificationType.INFO,
                            title: analysisStatus === 'business-request-needs-info'
                                ? 'notifications.ai_analysis_needs_info_title'
                                : 'notifications.ai_analysis_complete_title',
                            message: analysisStatus === 'business-request-needs-info'
                                ? 'notifications.ai_analysis_needs_info_message'
                                : 'notifications.ai_analysis_complete_message',
                            data: {
                                type: analysisStatus,
                                projectId: data.projectId,
                                requestId: data.requestId,
                            }
                        });
                    }
                    else if (data.type === 'generate-testcases') {
                        await updateStoryJob(data.storyId, {
                            kind: 'STORY_TEST_GENERATION',
                            status: 'RUNNING',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            startedAt: new Date().toISOString(),
                            error: null,
                        });

                        const result = await aiAnalystService.generateTestCasesFromStory(data.storyId, data.userId, data.language);

                        await updateStoryJob(data.storyId, {
                            kind: 'STORY_TEST_GENERATION',
                            status: 'COMPLETED',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            finishedAt: new Date().toISOString(),
                            error: null,
                            resultSummary: `${result.testCases.length} test cases generated`,
                        });

                        await notificationService.notifyUser(data.userId, {
                            type: NotificationType.INFO,
                            title: 'notifications.ai_tests_generated_title',
                            message: 'notifications.ai_tests_generated_message',
                            data: { storyId: data.storyId, suiteId: result.suiteId, projectId: data.projectId, count: result.testCases.length, type: 'testcases-generated' }
                        });
                    }

                    logger.info(`Completed AI job ${job.id} successfully`);
                    return { status: 'success', type: data.type };
                } catch (error: any) {
                    logger.error(`Failed AI job ${job.id}:`, error);

                    const projectId = (data as any).projectId;
                    if (data.type === 'analyze-business-request') {
                        await updateBusinessRequestJob(data.requestId, {
                            kind: 'BUSINESS_REQUEST_ANALYSIS',
                            status: 'FAILED',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            finishedAt: new Date().toISOString(),
                            error: error.message,
                            resultSummary: null,
                        });

                        await notificationService.notifyUser(data.userId, {
                            type: NotificationType.ERROR,
                            title: 'notifications.ai_analysis_failed_title',
                            message: 'notifications.ai_analysis_failed_message',
                            data: {
                                type: 'business-request-analysis-failed',
                                projectId: data.projectId,
                                requestId: data.requestId,
                                error: error.message,
                            },
                        });
                    } else if (data.type === 'generate-testcases') {
                        await updateStoryJob(data.storyId, {
                            kind: 'STORY_TEST_GENERATION',
                            status: 'FAILED',
                            jobId: String(job.id),
                            requestedById: data.userId,
                            finishedAt: new Date().toISOString(),
                            error: error.message,
                            resultSummary: null,
                        });

                        await notificationService.notifyUser(data.userId, {
                            type: NotificationType.ERROR,
                            title: 'notifications.ai_analysis_failed_title',
                            message: 'notifications.ai_analysis_failed_message',
                            data: {
                                type: 'testcases-generation-failed',
                                projectId,
                                storyId: data.storyId,
                                error: error.message,
                            },
                        });
                    } else if (projectId) {
                        await notificationService.notifyUser((data as any).userId, {
                            type: NotificationType.ERROR,
                            title: 'AI Generation Failed',
                            message: `An error occurred during AI generation: ${error.message}`,
                            data: { projectId, type: 'ai-generation-failed' }
                        });
                    }
                    throw error;
                }
            },
            {
                connection,
                // A single local GPU/model must process generations serially.
                // Parallel generations compete for VRAM and reduce total throughput.
                concurrency: 1,
            }
        );

        worker.on('active', (job) => {
            monitoringTelemetryService.recordQueue({
                queueName: AI_QUEUE_NAME,
                event: 'active',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: job.data,
            });
        });

        worker.on('completed', (job, result) => {
            monitoringTelemetryService.recordQueue({
                queueName: AI_QUEUE_NAME,
                event: 'completed',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: result,
            });
        });

        worker.on('failed', (job, err) => {
            logger.error(`AI job ${job?.id} failed with error ${err.message}`);
            monitoringTelemetryService.recordQueue({
                queueName: AI_QUEUE_NAME,
                event: 'failed',
                jobId: job?.id ?? null,
                jobName: job?.name ?? null,
                attemptsMade: job?.attemptsMade ?? null,
                data: job?.data,
                error: err.message,
            });
        });

        worker.on('error', err => {
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
