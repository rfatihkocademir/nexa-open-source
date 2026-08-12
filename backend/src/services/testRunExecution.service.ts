import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { playwrightGeneratorService } from './playwrightGenerator.service';
import { playwrightExecutorService } from './playwrightExecutor.service';
import { assertSafeAutomationTargets } from '../utils/outboundTarget';
import { ResultStatus } from '@prisma/client';
import { calculateFinalStatus } from '../utils/statusCalculator';
import { notificationService, NotificationType } from './notification.service';
import { automationQueue } from './queue/automation.queue';
import { bugReportingQueue } from './queue/bug-reporting.queue';
import { createLogger } from '../utils/logger';

const logger = createLogger('TestRunExecutionService');

export class TestRunExecutionService {
    async triggerAutomation(testRunId: string, userId: string, role: string) {
        await ProjectAccess.checkByRun(testRunId, userId, role);
        const itemsToRun = await prisma.testRunItem.findMany({
            where: {
                testRunId,
                automationStatus: 'UNTESTED',
                testCase: {
                    testCaseSteps: { some: { testStep: { type: 'WEB' } } }
                }
            },
            select: { id: true }
        });

        if (!Array.isArray(itemsToRun) || itemsToRun.length === 0) {
            if (itemsToRun && !Array.isArray(itemsToRun)) {
                logger.warn('Unexpected test run items payload while queuing automation jobs', { testRunId });
            }
            return;
        }

        // Push jobs to queue
        for (const item of itemsToRun) {
            await automationQueue.add(`exec-${item.id}`, {
                testRunId,
                itemId: item.id,
                userId,
                role
            });
        }
    }

    async triggerItemAutomation(itemId: string, userId: string, role: string) {
        const item = await prisma.testRunItem.findUnique({
            where: { id: itemId },
            include: {
                testRun: true,
                testCase: {
                    include: {
                        testCaseSteps: {
                            include: { testStep: true },
                            orderBy: { orderIndex: 'asc' }
                        }
                    }
                }
            },
        });

        if (!item) {
            throw new AppError('Test run item not found', 404);
        }

        if (item.testRun?.projectId) {
            await ProjectAccess.check(item.testRun.projectId, userId, role);
        }

        if (!(item.testCase as any).testCaseSteps?.some((ts: any) => ts.testStep?.type === 'WEB')) {
            throw new AppError('No WEB automation steps found for this test case', 400);
        }

        await automationQueue.add(`exec-${item.id}`, {
            testRunId: item.testRunId,
            itemId: item.id,
            userId,
            role
        });
    }

    // This internal method is now ONLY called by the BullMQ worker
    async executeItemAutomationInternal(itemId: string, userId?: string, _role?: string) {
        const item = await prisma.testRunItem.findUnique({
            where: { id: itemId },
            include: {
                testRun: true,
                testCase: {
                    include: {
                        testCaseSteps: {
                            include: { testStep: true },
                            orderBy: { orderIndex: 'asc' }
                        }
                    },
                },
            },
        });

        if (!item) return;

        let webSteps: any[] = [];
        let scenarioVariables: Record<string, string> = {};
        const tc: any = item.testCase;

        // 1. Check if an active/published AutomationScenario exists for this test case
        const scenario = await prisma.automationScenario.findFirst({
            // A draft is an editor artifact. Test runs must consume only the
            // last explicitly published contract so an in-progress builder
            // edit cannot silently change execution results.
            where: { testCaseId: item.testCaseId, deletedAt: null, status: 'PUBLISHED' },
            include: {
                steps: {
                    include: { testStep: true },
                    orderBy: { orderIndex: 'asc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (scenario && scenario.steps && scenario.steps.length > 0) {
            scenarioVariables = (scenario.variables as Record<string, string>) || {};
            webSteps = scenario.steps
                .filter((s: any) => s.testStep?.type === 'WEB' || !s.testStep?.type)
                .map((s: any) => s.testStep);
        } else if (tc.steps && Array.isArray(tc.steps)) {
            webSteps = tc.steps
                .filter((s: any) => s.type === 'WEB' || !s.type) // Treat undefined as WEB for now
                .map((s: any) => ({
                    name: s.action || 'Unnamed Step',
                    actionType: s.actionType,
                    locator: s.locator,
                    data: s.data
                }));
        } else {
            webSteps = tc.testCaseSteps
                ?.filter((ts: any) => ts.testStep?.type === 'WEB')
                ?.map((ts: any) => ts.testStep) || [];
        }

        if (webSteps.length === 0) return;

        const oldFinalStatus = item.finalStatus;

        try {
            await assertSafeAutomationTargets(webSteps, scenarioVariables);
            const script = playwrightGeneratorService.generateScript(
                webSteps,
                scenarioVariables
            );

            const result = await playwrightExecutorService.execute(script, item.id, { projectId: item.testRun?.projectId || undefined });

            const finalStatus = calculateFinalStatus(item.manualStatus, result.status);

            const errorStep = result.steps?.find(s => s.status === 'failed' || s.status === 'timedOut' || s.error);
            const logsStr = `Status: ${result.status}\nDuration: ${result.duration}ms\nLogs:\n${result.logs}\nError:\n${errorStep?.error || 'None'}`;

            const testResult = await prisma.testResult.create({
                data: {
                    runItemId: item.id,
                    status: result.status,
                    duration: result.duration,
                    comment: logsStr,
                    evidenceUrl: result.videoUrl || result.screenshotUrl || null,
                    testerId: userId || item.testCase.authorId, // Fallbacks if userId is undefined
                }
            });

            const updatedItem = await prisma.testRunItem.update({
                where: { id: item.id },
                data: {
                    automationStatus: result.status,
                    automationExecutedAt: new Date(),
                    finalStatus: finalStatus,
                },
                include: {
                    testRun: true,
                    testCase: true,
                },
            });

            // Check for consecutive failures
            if (result.status === 'FAIL' && updatedItem.testRun.projectId) {
                const previousItems = await prisma.testRunItem.findMany({
                    where: { testCaseId: item.testCaseId, id: { not: item.id }, automationStatus: { not: 'UNTESTED' } },
                    orderBy: { automationExecutedAt: 'desc' },
                    take: 1
                });
                if (previousItems.length > 0 && previousItems[0].automationStatus === 'FAIL') {
                    // Trigger AI Bug Reporter logic
                    logger.info(`2 consecutive failures detected for test case ${item.testCaseId}. Enqueueing bug report.`);
                    await bugReportingQueue.add(`bug-${testResult.id}`, {
                        testResultId: testResult.id,
                        projectId: updatedItem.testRun.projectId,
                        runItemId: item.id
                    });
                }
            }



            // Update run counts (delta calculation)
            await this.updateRunCounts(item.testRunId, oldFinalStatus, finalStatus);

            if (updatedItem.testRun.projectId) {
                notificationService.notifyProject(updatedItem.testRun.projectId, {
                    type: NotificationType.AUTOMATION_COMPLETED,
                    title: 'Automation Completed',
                    message: `Automation finished for case: ${updatedItem.testCase.title} with status ${result.status}`,
                    data: {
                        testRunId: updatedItem.testRunId,
                        itemId: item.id,
                        status: result.status,
                    },
                });
            }

            if (finalStatus === 'CONFLICT' && updatedItem.testRun.projectId) {
                notificationService.notifyProject(updatedItem.testRun.projectId, {
                    type: NotificationType.CONFLICT_DETECTED,
                    title: 'Conflict Detected',
                    message: `Conflict detected in test case: ${updatedItem.testCase.title}`,
                    data: {
                        testRunId: updatedItem.testRunId,
                        itemId: item.id,
                        manualStatus: item.manualStatus,
                        automationStatus: result.status,
                    },
                });
            }
        } catch (error: any) {
            logger.error(`Failed to execute automation for item ${item.id}:`, error);
            const failFinalStatus = calculateFinalStatus(item.manualStatus, ResultStatus.FAIL);
            const updatedItem = await prisma.testRunItem.update({
                where: { id: item.id },
                data: {
                    automationStatus: ResultStatus.FAIL,
                    automationExecutedAt: new Date(),
                    finalStatus: failFinalStatus,
                },
                include: {
                    testRun: true,
                    testCase: true,
                },
            });

            // Update run counts (delta calculation) for failure path
            await this.updateRunCounts(item.testRunId, oldFinalStatus, failFinalStatus);

            if (updatedItem.testRun.projectId) {
                notificationService.notifyProject(updatedItem.testRun.projectId, {
                    type: NotificationType.AUTOMATION_COMPLETED,
                    title: 'Automation Failed',
                    message: `Automation failed for case: ${updatedItem.testCase.title}`,
                    data: {
                        testRunId: updatedItem.testRunId,
                        itemId: item.id,
                        status: 'FAIL',
                    },
                });
            }
        }
    }

    private async updateRunCounts(testRunId: string, oldStatus: string, newStatus: string) {
        if (oldStatus === newStatus) return;

        const changes: Record<string, number> = {
            passedCount: 0,
            failedCount: 0,
            blockedCount: 0,
            untestedCount: 0,
        };

        // Decrement old status
        if (oldStatus === 'UNTESTED') changes.untestedCount--;
        else if (oldStatus === 'PASS') changes.passedCount--;
        else if (oldStatus === 'FAIL') changes.failedCount--;
        else if (oldStatus === 'BLOCK') changes.blockedCount--;

        // Increment new status
        if (newStatus === 'UNTESTED') changes.untestedCount++;
        else if (newStatus === 'PASS') changes.passedCount++;
        else if (newStatus === 'FAIL') changes.failedCount++;
        else if (newStatus === 'BLOCK') changes.blockedCount++;

        const updateData: any = {};
        for (const [key, value] of Object.entries(changes)) {
            if (value !== 0) {
                updateData[key] = { [value > 0 ? 'increment' : 'decrement']: Math.abs(value) };
            }
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.testRun.update({
                where: { id: testRunId },
                data: updateData,
            });
        }
    }
}

export const testRunExecutionService = new TestRunExecutionService();
