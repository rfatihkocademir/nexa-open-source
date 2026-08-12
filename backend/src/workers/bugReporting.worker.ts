import { Worker, Job } from 'bullmq';
import { connection } from '../services/queue/connection';
import { isRedisAvailable } from '../services/queue/connection';
import { BUG_REPORTING_QUEUE_NAME, BugReportingJobData } from '../services/queue/bug-reporting.queue';
import { AutoBugReporterService } from '../services/autoBugReporter.service';
import { monitoringTelemetryService } from '../services/monitoringTelemetry.service';
import prisma from '../utils/prisma';
import { WorkItemType, Priority } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('BugReportingWorker');

export const initBugReportingWorker = () => {
    logger.info('Initializing AI bug reporting worker...');
    const startWorkerPromise = (async () => {
        const redisEnabled = await isRedisAvailable();
        if (!redisEnabled) {
            logger.warn('Bug reporting worker disabled because Redis is unavailable');
            return { close: async () => undefined };
        }

        const worker = new Worker<BugReportingJobData>(
            BUG_REPORTING_QUEUE_NAME,
            async (job: Job) => {
                const { testResultId, projectId } = job.data;
                logger.info(`Started AI bug analysis for result ${testResultId}`);

                try {
                    const testResult = await prisma.testResult.findUnique({
                        where: { id: testResultId },
                        include: {
                            runItem: {
                                include: { testCase: true }
                            }
                        }
                    });

                    if (!testResult) {
                        throw new Error(`TestResult ${testResultId} not found`);
                    }

                    const aiResult = await AutoBugReporterService.analyzeFailure('system', 'ADMIN', testResultId, 'en');

                    const firstCol = await prisma.boardColumn.findFirst({
                        where: { projectId },
                        orderBy: { orderIndex: 'asc' }
                    });

                    const projectMember = await prisma.projectMember.findFirst({
                        where: { projectId },
                        orderBy: { joinedAt: 'asc' }
                    });

                    const markdownDescription = `
${aiResult.description}

### Steps to Reproduce
${aiResult.stepsToReproduce}

### AI Reasoning
${aiResult.reasoning}

---
**Auto-Generated Details:**
- **Test Case:** ${testResult.runItem.testCase.title}
- **Confidence:** ${aiResult.confidence}%
- **Evidence URL:** ${testResult.evidenceUrl ? `[View Evidence](${testResult.evidenceUrl})` : 'None'}

**Logs:**
\`\`\`text
${testResult.comment || 'No logs available.'}
\`\`\`
`.trim();

                    let pb: Priority = Priority.MEDIUM;
                    if (aiResult.severity === 'HIGH') pb = Priority.HIGH;
                    if (aiResult.severity === 'CRITICAL') pb = Priority.CRITICAL;
                    if (aiResult.severity === 'LOW') pb = Priority.LOW;

                    const bugTicket = await prisma.$transaction(async (tx) => {
                        const project = await tx.project.update({
                            where: { id: projectId },
                            data: { nextWorkItemNumber: { increment: 1 } },
                            select: { key: true, nextWorkItemNumber: true },
                        });
                        const sequenceNumber = project.nextWorkItemNumber - 1;

                        return tx.workItem.create({
                            data: {
                                projectId,
                                itemType: WorkItemType.BUG,
                                title: aiResult.title,
                                description: markdownDescription,
                                priority: pb,
                                boardColumnId: firstCol?.id || undefined,
                                assigneeId: projectMember?.userId || testResult.testerId || undefined,
                                reporterId: testResult.testerId || undefined,
                                key: `${project.key}-${sequenceNumber}`,
                                sequenceNumber,
                            }
                        });
                    });

                    logger.info(`Successfully created auto-bug ticket: ${bugTicket.id}`);
                    return { status: 'success', bugTicketId: bugTicket.id };
                } catch (error: any) {
                    logger.error(`Failed AI bug reporting for job ${job.id}:`, error);
                    throw error;
                }
            },
            {
                connection,
                concurrency: 1
            }
        );

        worker.on('active', (job) => {
            monitoringTelemetryService.recordQueue({
                queueName: BUG_REPORTING_QUEUE_NAME,
                event: 'active',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: job.data,
            });
        });

        worker.on('completed', (job, result) => {
            monitoringTelemetryService.recordQueue({
                queueName: BUG_REPORTING_QUEUE_NAME,
                event: 'completed',
                jobId: job.id ?? null,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
                data: result,
            });
        });

        worker.on('failed', (job, err) => {
            logger.error(`Bug reporting job ${job?.id} failed with error ${err.message}`);
            monitoringTelemetryService.recordQueue({
                queueName: BUG_REPORTING_QUEUE_NAME,
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
