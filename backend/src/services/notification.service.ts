import { SocketService } from './socket.service';
import { logger } from '../utils/logger';

export enum NotificationType {
    // Test Run related
    CONFLICT_DETECTED = 'CONFLICT_DETECTED',
    AUTOMATION_COMPLETED = 'AUTOMATION_COMPLETED',
    TEST_RUN_COMPLETED = 'TEST_RUN_COMPLETED',
    TEST_RUN_ASSIGNED = 'TEST_RUN_ASSIGNED',
    TEST_RUN_CLOSED = 'TEST_RUN_CLOSED',
    TEST_RUN_ITEMS_ADDED = 'TEST_RUN_ITEMS_ADDED',

    // Test Case related
    TEST_CASE_APPROVED = 'TEST_CASE_APPROVED',
    TEST_CASE_REVISION_REQUESTED = 'TEST_CASE_REVISION_REQUESTED',

    // Project related
    PROJECT_MEMBER_ADDED = 'PROJECT_MEMBER_ADDED',
    PROJECT_MEMBER_REMOVED = 'PROJECT_MEMBER_REMOVED',
    PROJECT_ARCHIVED = 'PROJECT_ARCHIVED',

    // Milestone related
    MILESTONE_CREATED = 'MILESTONE_CREATED',
    MILESTONE_COMPLETED = 'MILESTONE_COMPLETED',

    // Test Result related
    TEST_FAILED = 'TEST_FAILED',
    TEST_BLOCKED = 'TEST_BLOCKED',

    // Bug / Issue related
    BUG_CREATED = 'BUG_CREATED',
    ISSUE_REOPENED = 'ISSUE_REOPENED',

    // Release related
    RELEASE_READY = 'RELEASE_READY',
    RELEASE_BLOCKED = 'RELEASE_BLOCKED',
    DEPLOYMENT_COMPLETED = 'DEPLOYMENT_COMPLETED',

    // Approval Workflow
    APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
    APPROVAL_REJECTED = 'APPROVAL_REJECTED',

    // Gate related
    GATE_BLOCKED = 'GATE_BLOCKED',

    // System related (AI processing, generic success/failures)
    INFO = 'INFO',
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    IMPACT_DETECTED = 'IMPACT_DETECTED',
}

interface NotificationPayload {
    title: string;
    message: string;
    data?: any;
    type: NotificationType;
}

import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export class NotificationService {
    async notifyProject(projectId: string, payload: NotificationPayload) {
        try {
            // 1. Get all project members
            const members = await prisma.projectMember.findMany({
                where: { projectId },
                select: { userId: true }
            });

            if (members.length === 0) return;

            // 2. Create notifications in bulk
            await prisma.notification.createMany({
                data: members.map(m => ({
                    userId: m.userId,
                    title: payload.title,
                    message: payload.message,
                    type: payload.type,
                    data: payload.data,
                    read: false
                }))
            });

            // 3. Emit via socket to the project room (efficient for connected users)
            const socketService = SocketService.getInstance();
            socketService.notifyProject(projectId, payload);
            logger.info(`Notification sent to project_${projectId}: ${payload.title}`);
        } catch (error) {
            logger.error('Failed to send project notification', error);
        }
    }

    async notifyUser(userId: string, payload: NotificationPayload) {
        try {
            // 1. Create notification in DB
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title: payload.title,
                    message: payload.message,
                    type: payload.type,
                    data: payload.data,
                    read: false
                }
            });

            // 2. Emit via socket
            const socketService = SocketService.getInstance();
            socketService.notifyUser(userId, { ...payload, id: notification.id, createdAt: notification.createdAt });
            logger.info(`Notification sent to user_${userId}: ${payload.title}`);
        } catch (error) {
            logger.error('Failed to send user notification', error);
        }
    }

    async getUserNotifications(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.notification.count({ where: { userId, deletedAt: null } })
        ]);

        const unreadCount = await prisma.notification.count({
            where: { userId, read: false, deletedAt: null }
        });

        return {
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async markAsRead(id: string, userId: string) {
        const result = await prisma.notification.updateMany({
            where: { id, userId, deletedAt: null },
            data: { read: true },
        });
        if (result.count === 0) throw new AppError('Notification not found', 404);
        return result;
    }

    async markAllAsRead(userId: string) {
        return prisma.notification.updateMany({
            where: { userId, read: false, deletedAt: null },
            data: { read: true }
        });
    }

    async archive(id: string, userId: string) {
        const result = await prisma.notification.updateMany({
            where: { id, userId, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        if (result.count === 0) throw new AppError('Notification not found', 404);
        return result;
    }

    async restore(id: string, userId: string) {
        const result = await prisma.notification.updateMany({
            where: { id, userId, deletedAt: { not: null } },
            data: { deletedAt: null },
        });
        if (result.count === 0) throw new AppError('Notification not found', 404);
        return result;
    }

    async delete(id: string, userId: string) {
        return this.archive(id, userId);
    }

    async hardDelete(id: string, userId: string) {
        const result = await prisma.notification.deleteMany({ where: { id, userId } });
        if (result.count === 0) throw new AppError('Notification not found', 404);
        return result;
    }
}

export const notificationService = new NotificationService();
