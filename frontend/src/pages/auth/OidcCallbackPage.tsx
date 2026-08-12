import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { authService } from '@/services/auth.service';

export default function OidcCallbackPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [error, setError] = useState(false);

    useEffect(() => {
        const completeLogin = async () => {
            try {
                const session = await authService.refresh();
                useAuthStore.getState().setToken(session.token, session);
                const response = await api.get('/users/me');
                const payload = response as { data?: User; user?: User; projectPermissions?: Record<string, string[]> };
                login({ user: payload.data || payload.user!, token: session.token, projectPermissions: payload.projectPermissions || {} });
                navigate('/', { replace: true });
            } catch {
                useAuthStore.getState().logout();
                setError(true);
            }
        };
        void completeLogin();
    }, [login, navigate]);

    if (error) return <div className="flex min-h-screen items-center justify-center text-destructive">SSO oturumu tamamlanamadı.</div>;
    return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;
}
