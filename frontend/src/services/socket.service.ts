import { io, Socket } from 'socket.io-client';
import { createLogger } from '@/utils/logger';
import type { NotificationData } from './notification.service';

const logger = createLogger('SocketService');

export interface NotificationPayload {
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    data?: NotificationData;
}

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Array<(payload: unknown) => void>> = new Map();

    connect(token: string) {
        if (!token) return;

        if (this.socket) {
            if ((this.socket.auth as any)?.token === token && this.socket.connected) {
                return;
            }
            logger.info('Updating socket auth token and reconnecting...');
            this.socket.disconnect();
            this.socket = null;
        }

        const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
        const SOCKET_URL = new URL(apiUrl, window.location.origin).origin;

        logger.info('Connecting to socket server:', SOCKET_URL);

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
            logger.info('Socket connected successfully:', this.socket?.id);
        });

        this.socket.on('connect_error', (err) => {
            logger.error('Socket connection error:', err);
        });

        this.socket.on('disconnect', () => {
            logger.info('Socket disconnected');
        });

        this.socket.on('notification', (payload: NotificationPayload) => {
            logger.info('Received notification:', payload);
            this.notifyListeners('notification', payload);
        });
    }

    disconnect() {
        if (this.socket) {
            logger.info('Disconnecting...');
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    joinProject(projectId: string) {
        if (this.socket) {
            logger.info('Joining project room:', projectId);
            this.socket.emit('join_project', projectId);
        } else {
            logger.warn('Cannot join project, socket not connected');
        }
    }

    leaveProject(projectId: string) {
        if (this.socket) {
            logger.info('Leaving project room:', projectId);
            this.socket.emit('leave_project', projectId);
        }
    }

    on<T>(event: string, callback: (payload: T) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback as (payload: unknown) => void);
    }

    off<T>(event: string, callback: (payload: T) => void) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event)?.filter((listener) => listener !== (callback as (payload: unknown) => void));
        this.listeners.set(event, callbacks || []);
    }

    private notifyListeners<T>(event: string, payload: T) {
        const listeners = this.listeners.get(event) as Array<(payload: T) => void> | undefined;
        listeners?.forEach((callback) => callback(payload));
    }
}

export const socketService = new SocketService();
