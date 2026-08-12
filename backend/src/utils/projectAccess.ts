import prisma from './prisma';
import { AppError } from './AppError';

export class ProjectAccess {
    static async check(projectId: string, userId: string, role: string) {
        if (!projectId || projectId === 'global') {
            throw new AppError('A project scope is required', 403);
        }
        const scopedProject = await prisma.project.findFirst({
            where: {
                id: projectId,
                organization: { members: { some: { userId } } },
            },
            select: { requireExplicitAdminMembership: true },
        });
        if (!scopedProject) throw new AppError('Project not found or outside your organization', 404);
        if (role === 'ADMIN' || role === 'admin') {
            if (!scopedProject.requireExplicitAdminMembership) return true;
        }

        const membership = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        if (!membership) {
            throw new AppError(`You do not have access to this project (User ID: ${userId}, Role: ${role}, Project: ${projectId})`, 403);
        }

        return true;
    }

    static async checkBySuite(suiteId: string, userId: string, role: string) {
        const suite = await prisma.testSuite.findUnique({
            where: { id: suiteId },
            select: { projectId: true },
        });

        if (!suite) {
            throw new AppError('Test suite not found', 404);
        }

        return this.check(suite.projectId, userId, role);
    }

    static async checkByRun(runId: string, userId: string, role: string) {
        const run = await prisma.testRun.findUnique({
            where: { id: runId },
            select: { projectId: true },
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        if (!run.projectId) throw new AppError('Unscoped test runs are not accessible', 403);

        return this.check(run.projectId, userId, role);
    }

    static async checkByRunItem(runItemId: string, userId: string, role: string) {
        const item = await prisma.testRunItem.findUnique({
            where: { id: runItemId },
            select: {
                testRun: {
                    select: {
                        id: true,
                        projectId: true,
                    },
                },
            },
        });

        if (!item) {
            throw new AppError('Test run item not found', 404);
        }

        if (!item.testRun.projectId) throw new AppError('Unscoped test runs are not accessible', 403);

        return this.check(item.testRun.projectId, userId, role);
    }

    static async checkByWorkItem(workItemId: string, userId: string, role: string) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workItemId);
        const workItem = await prisma.workItem.findFirst({
            where: isUUID ? { id: workItemId } : { key: workItemId },
            select: { projectId: true },
        });

        if (!workItem) {
            throw new AppError('Work item not found', 404);
        }

        return this.check(workItem.projectId, userId, role);
    }

    static async checkByComment(commentId: string, userId: string, role: string) {
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: {
                workItem: {
                    select: { projectId: true },
                },
            },
        });

        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        if (!comment.workItem) {
            throw new AppError('Comment is not attached to a work item', 400);
        }

        return this.check(comment.workItem.projectId, userId, role);
    }

    static async checkByTag(tagId: string, userId: string, role: string) {
        const tag = await prisma.tag.findUnique({
            where: { id: tagId },
            select: { projectId: true },
        });

        if (!tag) {
            throw new AppError('Tag not found', 404);
        }

        return this.check(tag.projectId, userId, role);
    }

    static async checkByTestCase(testCaseId: string, userId: string, role: string) {
        const testCase = await prisma.testCase.findUnique({
            where: { id: testCaseId },
            select: {
                suite: {
                    select: { projectId: true },
                },
            },
        });

        if (!testCase) {
            throw new AppError('Test case not found', 404);
        }

        return this.check(testCase.suite.projectId, userId, role);
    }

    static async checkByTestResult(testResultId: string, userId: string, role: string) {
        const testResult = await prisma.testResult.findUnique({
            where: { id: testResultId },
            select: {
                runItem: {
                    select: {
                        testRun: {
                            select: { projectId: true },
                        },
                    },
                },
            },
        });

        if (!testResult) {
            throw new AppError('Test result not found', 404);
        }

        const projectId = testResult.runItem.testRun.projectId;
        if (!projectId) throw new AppError('Unscoped test results are not accessible', 403);

        return this.check(projectId, userId, role);
    }

    static async checkByWikiPage(wikiPageId: string, userId: string, role: string) {
        const wikiPage = await prisma.wikiPage.findUnique({
            where: { id: wikiPageId },
            select: {
                space: {
                    select: { projectId: true },
                },
            },
        });

        if (!wikiPage) {
            throw new AppError('Wiki page not found', 404);
        }

        return this.check(wikiPage.space.projectId, userId, role);
    }

    static async checkByEnvironment(environmentId: string, userId: string, role: string) {
        const environment = await prisma.environment.findUnique({
            where: { id: environmentId },
            select: { projectId: true },
        });

        if (!environment) {
            throw new AppError('Environment not found', 404);
        }

        return this.check(environment.projectId, userId, role);
    }

    static async checkByAttachment(attachmentId: string, userId: string, role: string) {
        const attachment = await prisma.attachment.findUnique({
            where: { id: attachmentId },
            select: {
                uploadedById: true,
                workItem: { select: { projectId: true } },
                comment: { select: { workItem: { select: { projectId: true } } } },
                testResult: { select: { runItem: { select: { testRun: { select: { projectId: true } } } } } },
                testCase: { select: { suite: { select: { projectId: true } } } },
                wikiPage: { select: { space: { select: { projectId: true } } } },
            },
        });

        if (!attachment) {
            throw new AppError('Attachment not found', 404);
        }

        const projectId =
            attachment.workItem?.projectId ||
            attachment.comment?.workItem?.projectId ||
            attachment.testResult?.runItem.testRun.projectId ||
            attachment.testCase?.suite.projectId ||
            attachment.wikiPage?.space.projectId ||
            null;

        if (!projectId) {
            if (attachment.uploadedById !== userId) {
                throw new AppError('You do not have access to this attachment', 403);
            }
            return true;
        }

        return this.check(projectId, userId, role);
    }
}
