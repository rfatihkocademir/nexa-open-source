import prisma from '../utils/prisma';
import { ResultStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { AddResultInput } from '../validations/testResult.validation';
import { calculateFinalStatus } from '../utils/statusCalculator';
import { assertAttachmentsAccessible } from './storage.service';

export class TestResultService {
    async autoCreateBugForFailure(tx: any, runItemId: string, userId: string, comment?: string) {
        // Find the test run item, including case and its parent work item
        const item = await tx.testRunItem.findUnique({
            where: { id: runItemId },
            include: {
                testCase: {
                    include: {
                        workItem: {
                            include: {
                                children: true
                            }
                        }
                    }
                }
            }
        });

        if (!item || !item.testCase || !item.testCase.workItem) {
            return;
        }

        const parentWorkItem = item.testCase.workItem;
        const projectId = parentWorkItem.projectId;

        // Determine developer to assign the bug to
        let developerId = parentWorkItem.assigneeId;

        // Try to find a development task in children
        if (parentWorkItem.children) {
            const devTask = parentWorkItem.children.find((child: any) => {
                const title = (child.title || "").toLowerCase();
                return child.itemType === 'TASK' && (title.includes('geliştirme') || title.includes('development') || title.includes('dev'));
            });

            if (devTask && devTask.assigneeId) {
                developerId = devTask.assigneeId;
            }
        }

        // Fallback to tester if no assignee
        if (!developerId) {
            developerId = item.assigneeId || userId;
        }

        // Get the first column of the agile board to place the bug (typically "To Do")
        const firstCol = await tx.boardColumn.findFirst({
            where: { projectId },
            orderBy: { orderIndex: 'asc' }
        });

        // Construct steps to reproduce
        let stepsToReproduce = 'Test Case: ' + (item.testCase.title || 'Untitled Test Case') + '\n';
        if (item.testCase.steps) {
            try {
                const stepsObj = typeof item.testCase.steps === 'string' 
                    ? JSON.parse(item.testCase.steps) 
                    : item.testCase.steps;
                if (Array.isArray(stepsObj)) {
                    stepsObj.forEach((s: any, idx: number) => {
                        stepsToReproduce += `${idx + 1}. Action: ${s.action || s.name || ''} - Expected: ${s.expected || s.expectedResult || ''}\n`;
                    });
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Check if an open bug already exists for this test run item to prevent duplication
        const existingBug = await tx.workItem.findFirst({
            where: {
                parentId: parentWorkItem.id,
                itemType: 'BUG',
                title: { startsWith: `Bug: [Test Fail] ${item.testCase.title}` },
                status: { notIn: ['DONE', 'CLOSED', 'REJECTED'] }
            }
        });

        if (existingBug) {
            return;
        }

        // Create the bug subtask
        await tx.workItem.create({
            data: {
                projectId,
                itemType: 'BUG',
                title: `Bug: [Test Fail] ${item.testCase.title}`,
                description: `Test Case: ${item.testCase.title} has failed.\nRun Item: ${runItemId}\nComment/Notes: ${comment || 'No comment provided.'}`,
                priority: parentWorkItem.priority || 'HIGH',
                status: 'TODO',
                boardColumnId: firstCol?.id || null,
                parentId: parentWorkItem.id,
                assigneeId: developerId,
                reporterId: userId,
                requirementId: parentWorkItem.requirementId,
                stepsToReproduce: stepsToReproduce || 'Failed during test run execution.',
                severity: 'HIGH'
            }
        });
    }

    async addResult(runItemId: string, data: AddResultInput, userId: string, role: string) {
        // Check if item exists
        const item = await prisma.testRunItem.findUnique({
            where: { id: runItemId },
            include: { testRun: true },
        });

        if (!item) {
            throw new AppError('Test run item not found', 404);
        }

        await ProjectAccess.checkByRunItem(runItemId, userId, role);

        if (item.testRun.status === 'COMPLETED' || item.testRun.status === 'ARCHIVED') {
            throw new AppError('Cannot add results to a closed or archived test run', 400);
        }

        if (data.attachmentIds?.length) {
            await assertAttachmentsAccessible(data.attachmentIds, { userId, role });
        }

        // Transaction: Add Result -> Update Item -> Update Run Counts
        return prisma.$transaction(async (tx) => {
            // 1. Create Result
            const result = await tx.testResult.create({
                data: {
                    runItemId,
                    status: data.status,
                    duration: data.duration,
                    comment: data.comment,
                    stepResults: data.stepResults as any,
                    evidenceUrl: data.evidenceUrl,
                    testerId: userId,
                    attachments: data.attachmentIds?.length ? {
                        connect: data.attachmentIds.map(id => ({ id }))
                    } : undefined
                },
            });

            // Calculate New Final Status
            const newFinalStatus = calculateFinalStatus(data.status, item.automationStatus);
            const oldFinalStatus = item.finalStatus;

            // Auto-create bug if test run item fails
            if (newFinalStatus === 'FAIL') {
                await this.autoCreateBugForFailure(tx, runItemId, userId, data.comment);
            }

            // 2. Update Item Status & Assignee (if not assigned)
            await tx.testRunItem.update({
                where: { id: runItemId },
                data: {
                    manualStatus: data.status,
                    manualExecutedAt: new Date(),
                    finalStatus: newFinalStatus,
                    assigneeId: item.assigneeId || userId, // Auto-assign if null
                },
            });

            // 2.1 Create execution event (manual)
            if (item.testRun.projectId) {
                await tx.executionEvent.create({
                    data: {
                        projectId: item.testRun.projectId,
                        runId: item.testRunId,
                        runItemId: item.id,
                        testCaseId: item.testCaseId,
                        testerId: userId,
                        status: newFinalStatus,
                        durationMs: data.duration ?? null,
                        source: 'MANUAL',
                    },
                });
            }

            // 3. Update Run Counts (Delta Calculation)
            const changes = {
                passedCount: 0,
                failedCount: 0,
                blockedCount: 0,
                untestedCount: 0
            };

            // Handle Old Status
            if (oldFinalStatus === 'UNTESTED') changes.untestedCount--;
            else if (oldFinalStatus === 'PASS') changes.passedCount--;
            else if (oldFinalStatus === 'FAIL') changes.failedCount--;
            else if (oldFinalStatus === 'BLOCK') changes.blockedCount--;

            // Handle New Status
            if (newFinalStatus === 'UNTESTED') changes.untestedCount++;
            else if (newFinalStatus === 'PASS') changes.passedCount++;
            else if (newFinalStatus === 'FAIL') changes.failedCount++;
            else if (newFinalStatus === 'BLOCK') changes.blockedCount++;

            const updateData: any = {};
            if (changes.untestedCount !== 0) updateData.untestedCount = { [changes.untestedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.untestedCount) };
            if (changes.passedCount !== 0) updateData.passedCount = { [changes.passedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.passedCount) };
            if (changes.failedCount !== 0) updateData.failedCount = { [changes.failedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.failedCount) };
            if (changes.blockedCount !== 0) updateData.blockedCount = { [changes.blockedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.blockedCount) };

            // Only update if there are changes
            if (Object.keys(updateData).length > 0) {
                await tx.testRun.update({
                    where: { id: item.testRunId },
                    data: updateData,
                    select: { untestedCount: true }
                });

                // Auto-close removed as per user request
            }

            return result;
        });
    }

    async getById(id: string, userId: string, role: string) {
        const result = await prisma.testResult.findFirst({
            where: { id, deletedAt: null },
            include: {
                tester: { select: { id: true, firstName: true, lastName: true } },
                attachments: true
            }
        });

        if (!result) throw new AppError('Test result not found', 404);
        
        // We can check access by runItem
        await ProjectAccess.checkByRunItem(result.runItemId, userId, role);
        
        return result;
    }

    async getHistory(runItemId: string, userId: string, role: string) {
        await ProjectAccess.checkByRunItem(runItemId, userId, role);

        return prisma.testResult.findMany({
            where: { runItemId, deletedAt: null },
            include: {
                tester: { select: { id: true, firstName: true, lastName: true } },
                attachments: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async update(id: string, data: Partial<AddResultInput>, userId: string, role: string) {
        const result = await prisma.testResult.findFirst({ where: { id, deletedAt: null } });
        if (!result) throw new AppError('Test result not found', 404);

        await ProjectAccess.checkByRunItem(result.runItemId, userId, role);

        return prisma.testResult.update({
            where: { id },
            data: {
                status: data.status,
                duration: data.duration,
                comment: data.comment,
                stepResults: data.stepResults as any,
                evidenceUrl: data.evidenceUrl,
                attachments: data.attachmentIds?.length ? {
                    set: data.attachmentIds.map(id => ({ id }))
                } : undefined
            }
        });
    }

    async archive(id: string, userId: string, role: string) {
        const result = await prisma.testResult.findFirst({ where: { id, deletedAt: null } });
        if (!result) throw new AppError('Test result not found', 404);

        await ProjectAccess.checkByRunItem(result.runItemId, userId, role);

        return prisma.testResult.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async restore(id: string, userId: string, role: string) {
        const result = await prisma.testResult.findUnique({ where: { id } });
        if (!result) throw new AppError('Test result not found', 404);

        await ProjectAccess.checkByRunItem(result.runItemId, userId, role);

        return prisma.testResult.update({
            where: { id },
            data: { deletedAt: null }
        });
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    async hardDelete(id: string, userId: string, role: string) {
        const result = await prisma.testResult.findUnique({ where: { id } });
        if (!result) throw new AppError('Test result not found', 404);

        await ProjectAccess.checkByRunItem(result.runItemId, userId, role);

        return prisma.testResult.delete({
            where: { id }
        });
    }

    async addAutomationResult(runItemId: string, status: ResultStatus, userId: string, role: string, _duration?: number, errorOutput?: string, videoUrl?: string) {
        const item = await prisma.testRunItem.findUnique({
            where: { id: runItemId },
        });

        if (!item) {
            throw new AppError('Test run item not found', 404);
        }

        await ProjectAccess.checkByRunItem(runItemId, userId, role);

        return prisma.$transaction(async (tx) => {
            // Calculate New Final Status
            const newFinalStatus = calculateFinalStatus(item.manualStatus, status);
            const oldFinalStatus = item.finalStatus;

            // Auto-create bug if test run item fails
            if (newFinalStatus === 'FAIL') {
                await this.autoCreateBugForFailure(tx, runItemId, userId, errorOutput || 'Automation test failed.');
            }

            // Update Item
            const updatedItem = await tx.testRunItem.update({
                where: { id: runItemId },
                data: {
                    automationStatus: status,
                    automationExecutedAt: new Date(),
                    finalStatus: newFinalStatus,
                    errorOutput,
                    videoUrl,
                },
            });

            // Automation event
            if (item.testRunId) {
                const [run, _testCase] = await Promise.all([
                    tx.testRun.findUnique({ where: { id: item.testRunId } }),
                    tx.testCase.findUnique({ where: { id: item.testCaseId }, select: { id: true } })
                ]);
                if (run?.projectId) {
                    await tx.automationEvent.create({
                        data: {
                            projectId: run.projectId,
                            runId: run.id,
                            runItemId: item.id,
                            scenarioId: null,
                            status,
                            conflict: newFinalStatus === 'CONFLICT',
                            errorOutput,
                            videoUrl,
                        },
                    });
                }
            }

            // 3. Update Run Counts (Delta Calculation)
            const changes = {
                passedCount: 0,
                failedCount: 0,
                blockedCount: 0,
                untestedCount: 0
            };

            // Handle Old Status
            if (oldFinalStatus === 'UNTESTED') changes.untestedCount--;
            else if (oldFinalStatus === 'PASS') changes.passedCount--;
            else if (oldFinalStatus === 'FAIL') changes.failedCount--;
            else if (oldFinalStatus === 'BLOCK') changes.blockedCount--;

            // Handle New Status
            if (newFinalStatus === 'UNTESTED') changes.untestedCount++;
            else if (newFinalStatus === 'PASS') changes.passedCount++;
            else if (newFinalStatus === 'FAIL') changes.failedCount++;
            else if (newFinalStatus === 'BLOCK') changes.blockedCount++;

            const updateData: any = {};
            if (changes.untestedCount !== 0) updateData.untestedCount = { [changes.untestedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.untestedCount) };
            if (changes.passedCount !== 0) updateData.passedCount = { [changes.passedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.passedCount) };
            if (changes.failedCount !== 0) updateData.failedCount = { [changes.failedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.failedCount) };
            if (changes.blockedCount !== 0) updateData.blockedCount = { [changes.blockedCount > 0 ? 'increment' : 'decrement']: Math.abs(changes.blockedCount) };

            if (Object.keys(updateData).length > 0) {
                await tx.testRun.update({
                    where: { id: item.testRunId },
                    data: updateData,
                    select: { untestedCount: true }
                });

                // Auto-close removed as per user request
            }

            return updatedItem;
        });
    }
}

export const testResultService = new TestResultService();
