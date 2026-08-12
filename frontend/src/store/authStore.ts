import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, LoginResponse } from '@/types/auth';
import { socketService } from '@/services/socket.service';

const AUTH_STORAGE_NAME = 'nexa-auth-storage';

interface AuthState {
    user: User | null;
    token: string | null;
    permissions: Record<string, string[]>;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: LoginResponse) => void;
    logout: () => void;
    setToken: (token: string, session?: { user?: User; projectPermissions?: Record<string, string[]> }) => void;
    setLoading: (loading: boolean) => void;
    clearSession: () => void;
    updateUser: (user: Partial<User>) => void;
    checkPermission: (projectId: string, permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            permissions: {},
            isAuthenticated: false,
            isLoading: true,

            login: (data: LoginResponse) => {
                if (data.token) {
                    socketService.connect(data.token);
                }
                set({
                    user: data.user,
                    token: data.token,
                    permissions: data.projectPermissions || {},
                    isAuthenticated: !!data.token,
                });
            },

            logout: () => {
                const token = get().token;
                socketService.disconnect();
                void fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/logout`, {
                    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: '{}',
                }).catch(() => undefined);
                set({
                    user: null,
                    token: null,
                    permissions: {},
                    isAuthenticated: false,
                });
            },

            setToken: (token, session) => {
                if (token) {
                    socketService.connect(token);
                }
                set({ token, isAuthenticated: true, ...(session?.user ? { user: session.user } : {}), ...(session?.projectPermissions ? { permissions: session.projectPermissions } : {}) });
            },
            setLoading: (isLoading) => set({ isLoading }),
            clearSession: () => {
                socketService.disconnect();
                set({
                    user: null,
                    token: null,
                    permissions: {},
                    isAuthenticated: false,
                    isLoading: false,
                });
            },

            updateUser: (updatedUser: Partial<User>) => {
                const currentUser = get().user;
                if (!currentUser) return;
                set({ user: { ...currentUser, ...updatedUser } });
            },

            checkPermission: (projectId: string, permission: string) => {
                const { user, permissions } = get();
                if (!user) return false;
                if (user.role === 'ADMIN') return true;

                const projectPerms = permissions[projectId] || [];
                return projectPerms.includes(permission);
            }
        }),
        {
            name: AUTH_STORAGE_NAME,
            version: 2,
            storage: createJSONStorage(() => localStorage),
            migrate: (persistedState) => {
                const state = persistedState as Partial<AuthState>;
                return { ...state, token: null, isAuthenticated: false } as AuthState;
            },
            partialize: (state) => ({
                user: state.user,
                permissions: state.permissions,
                isAuthenticated: state.isAuthenticated
            }), // What to persist
        }
    )
);
