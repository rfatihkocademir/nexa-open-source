import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { notificationService, NotificationType } from './notification.service';

export class TestRunNotificationService {
    async notifyCompletion(testRunId: string, userId: string) {
        const run = await prisma.testRun.findUnique({
            where: { id: testRunId },
            include: { creator: true }
        });

        if (!run) {
            throw new AppError('Test run not found', 404);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        notificationService.notifyUser(run.creatorId, {
            type: NotificationType.TEST_RUN_COMPLETED,
            title: 'notifications.test_run_completed_title',
            message: 'notifications.test_run_completed_message',
            data: {
                testRunId: run.id,
                userId,
                userName: `${user?.firstName} ${user?.lastName}`,
                runTitle: run.title
            }
        });
    }
}

export const testRunNotificationService = new TestRunNotificationService();
