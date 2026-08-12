import { api } from './api';
import type { User, Role } from '@/types/auth';

export interface CreateUserInput {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: Role;
}

export interface UpdateUserInput {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
    isActive?: boolean;
}

export interface UpdateMeInput {
    firstName?: string;
    lastName?: string;
    password?: string;
    avatarUrl?: string | null;
}

export const userService = {
    getMe: async (): Promise<User> => {
        const response: any = await api.get('/users/me');
        return response.data;
    },

    updateMe: async (data: UpdateMeInput): Promise<User> => {
        const response: any = await api.patch('/users/me', data);
        return response.data;
    },

    getAll: async (): Promise<User[]> => {
        const response: any = await api.get('/users');
        return response.data;
    },

    getById: async (id: string): Promise<User> => {
        const response: any = await api.get(`/users/${id}`);
        return response.data;
    },

    create: async (data: CreateUserInput): Promise<User> => {
        const response: any = await api.post('/users', data);
        return response.data;
    },

    update: async (id: string, data: UpdateUserInput): Promise<User> => {
        const response: any = await api.patch(`/users/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/users/${id}`);
    },
};
