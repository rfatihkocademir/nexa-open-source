import prisma from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { notificationService, NotificationType } from "./notification.service";
import { knowledgeService } from "./knowledge.service";
import { ProjectAccess } from "../utils/projectAccess";
// import { WorkItemType } from "@prisma/client";

interface CreateCommentInput {
    content: string;
    workItemId?: string;
    authorId: string;
    role: string;
}

export class CommentService {
    static async create(input: CreateCommentInput) {
        if (!input.workItemId) {
            throw new AppError("Comment must be attached to a work item", 400);
        }

        await ProjectAccess.checkByWorkItem(input.workItemId, input.authorId, input.role);

        // 1. Create Comment
        const comment = await prisma.comment.create({
            data: {
                content: input.content,
                workItemId: input.workItemId,
                authorId: input.authorId
            },
            include: {
                author: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: true }
                }
            }
        });

        // 2. Handle Mentions & Auto-Assign
        if (input.workItemId) {
            await this.handleMentions(input.workItemId, input.content, input.authorId);
        }

        // 3. Index for Project Memory
        const workItem = await prisma.workItem.findUnique({
            where: { id: input.workItemId },
            select: { projectId: true }
        });
        if (workItem) {
            knowledgeService.indexEntity(workItem.projectId, 'Comment', comment.id, comment.content);
        }

        return comment;
    }

    static async getByWorkItemId(workItemId: string, userId: string, role: string) {
        await ProjectAccess.checkByWorkItem(workItemId, userId, role);

        return await prisma.comment.findMany({
            where: { workItemId, deletedAt: null },
            include: {
                author: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    static async getById(id: string, userId: string, role: string) {
        const comment = await prisma.comment.findFirst({
            where: { id, deletedAt: null },
            include: {
                author: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
        });

        if (!comment) throw new AppError("Comment not found", 404);
        if (comment.workItemId) {
            await ProjectAccess.checkByWorkItem(comment.workItemId, userId, role);
        }

        return comment;
    }

    static async update(id: string, content: string, userId: string, role: string) {
        const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } });
        if (!comment) throw new AppError("Comment not found", 404);

        if (comment.authorId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only edit your own comments", 403);
        }

        return await prisma.comment.update({
            where: { id },
            data: { content }
        });
    }

    static async archive(id: string, userId: string, role: string) {
        const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } });
        if (!comment) throw new AppError("Comment not found", 404);

        if (comment.authorId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only delete your own comments", 403);
        }

        return await prisma.comment.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    static async restore(id: string, userId: string, role: string) {
        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) throw new AppError("Comment not found", 404);

        if (comment.authorId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only restore your own comments", 403);
        }

        return await prisma.comment.update({
            where: { id },
            data: { deletedAt: null }
        });
    }

    static async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }

    static async hardDelete(id: string, userId: string, role: string) {
        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) throw new AppError("Comment not found", 404);

        if (comment.authorId !== userId && role !== 'ADMIN') {
            throw new AppError("You can only delete your own comments", 403);
        }

        await prisma.comment.delete({ where: { id } });
        return { success: true };
    }

    // Helper: Handle Mentions
    private static async handleMentions(workItemId: string, content: string, commenterId: string) {
        // Retrieve project ID from workItem
        const workItem = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { project: true }
        });
        if (!workItem) return;

        // Get matching users from project members
        const members = await prisma.projectMember.findMany({
            where: { projectId: workItem.projectId },
            include: { user: true }
        });

        // Check content for mentions
        for (const member of members) {
            const mentionTag = `@${member.user.firstName}`; // Simple logic: @FirstName
            // Check if mention exists and user is NOT the commenter
            if (content.includes(mentionTag) && member.userId !== commenterId) {

                // 1. Auto-Assign
                // 2. Change Status
                await prisma.workItem.update({
                    where: { id: workItemId },
                    data: {
                        assigneeId: member.userId,
                        status: 'WAITING_FOR_INFO'
                    }
                });

                // 3. Notify User
                await notificationService.notifyUser(member.userId, {
                    title: 'New Mention in Work Item',
                    message: `${workItem.title}: You were mentioned by a colleague.`,
                    type: NotificationType.TEST_RUN_ASSIGNED,
                    data: {
                        entityType: 'workitem',
                        entityId: workItemId,
                        projectId: workItem.projectId,
                        commentId: 'latest'
                    }
                });

                break;
            }
        }
    }
}
