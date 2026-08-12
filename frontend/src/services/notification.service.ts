import { api } from './api';
import type { JsonObject } from '@/types/json';

export interface NotificationData extends JsonObject {
    projectId?: string;
    testRunId?: string;
    requestId?: string;
    storyId?: string;
    suiteId?: string;
    milestoneId?: string;
    type?: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    read: boolean;
    createdAt: string;
    data?: NotificationData;
}

export interface NotificationListResponse {
    notifications: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
}

export const notificationService = {
    list: async (page = 1, limit = 20): Promise<NotificationListResponse> => {
        const response: any = await api.get('/notifications', {
            params: { page, limit }
        });
        const resData = response?.data || response;
        return {
            notifications: Array.isArray(resData?.notifications) ? resData.notifications : [],
            total: resData?.total || 0,
            unreadCount: resData?.unreadCount || 0,
            page: resData?.page || page,
            totalPages: resData?.totalPages || 1
        };
    },

    markAsRead: async (id: string): Promise<void> => {
        await api.patch(`/notifications/${id}/read`);
    },

    markAllAsRead: async (): Promise<void> => {
        await api.patch('/notifications/read-all');
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/notifications/${id}`);
    }
};
