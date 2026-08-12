import { useEffect, type ReactNode } from "react";

import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/authStore";
import i18n from "@/lib/i18n";

let bootstrapRefreshPromise: ReturnType<typeof authService.refresh> | null = null;

function refreshSessionOnce() {
    bootstrapRefreshPromise ||= authService.refresh().finally(() => {
        bootstrapRefreshPromise = null;
    });
    return bootstrapRefreshPromise;
}

export function AuthSessionBootstrap({ children }: { children: ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const token = useAuthStore((state) => state.token);
    const setToken = useAuthStore((state) => state.setToken);
    const setLoading = useAuthStore((state) => state.setLoading);
    const clearSession = useAuthStore((state) => state.clearSession);
    const userLanguage = useAuthStore((state) => state.user?.language);

    useEffect(() => {
        if (userLanguage && userLanguage !== i18n.language) void i18n.changeLanguage(userLanguage);
    }, [userLanguage]);

    useEffect(() => {
        let cancelled = false;
        const initialize = async () => {
            if (!isAuthenticated || token) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const session = await refreshSessionOnce();
                if (!cancelled) setToken(session.token, session);
            } catch {
                if (!cancelled) clearSession();
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void initialize();
        return () => {
            cancelled = true;
        };
    }, [clearSession, isAuthenticated, setLoading, setToken, token]);

    return children;
}
