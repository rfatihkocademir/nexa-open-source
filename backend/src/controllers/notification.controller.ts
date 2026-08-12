import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendResponse } from '../utils/apiResponse';
import { getRequestActor } from '../utils/requestContext';

export class NotificationController {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const result = await notificationService.getUserNotifications(userId, page, limit);
            sendResponse(res, 200, result, 'Notifications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async markRead(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            await notificationService.markAsRead(req.params.id, userId);
            sendResponse(res, 200, null, 'Notification marked as read');
        } catch (error) {
            next(error);
        }
    }

    async markAllRead(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            await notificationService.markAllAsRead(userId);
            sendResponse(res, 200, null, 'All notifications marked as read');
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = getRequestActor(req);
            await notificationService.delete(req.params.id, userId);
            sendResponse(res, 200, null, 'Notification deleted');
        } catch (error) {
            next(error);
        }
    }
}

export const notificationController = new NotificationController();
