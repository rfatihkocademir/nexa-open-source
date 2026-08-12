import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface LocationLike {
    pathname?: string;
    search?: string;
    hash?: string;
}

interface LocationStateWithFrom {
    from?: string | LocationLike | null;
}

function isLocationStateWithFrom(value: unknown): value is LocationStateWithFrom {
    return typeof value === "object" && value !== null && "from" in value;
}

export function useSmartBackNavigation(fallbackTo: string) {
    const navigate = useNavigate();
    const location = useLocation();

    const from = useMemo(() => {
        if (!isLocationStateWithFrom(location.state)) {
            return null;
        }

        const fromValue = location.state.from;
        if (typeof fromValue === "string") {
            return fromValue.trim().length > 0 ? fromValue : null;
        }

        if (fromValue && typeof fromValue === "object" && typeof fromValue.pathname === "string") {
            const search = typeof fromValue.search === "string" ? fromValue.search : "";
            const hash = typeof fromValue.hash === "string" ? fromValue.hash : "";
            const nextPath = `${fromValue.pathname}${search}${hash}`;
            return nextPath.trim().length > 0 ? nextPath : null;
        }

        return null;
    }, [location.state]);

    const goBack = useCallback(() => {
        const currentPath = `${location.pathname}${location.search}`;

        if (from && from !== currentPath) {
            navigate(from);
            return;
        }

        const historyIndex = typeof window !== "undefined" ? Number(window.history.state?.idx ?? 0) : 0;
        const hasHistoryEntry = typeof window !== "undefined"
            ? historyIndex > 0 || window.history.length > 1
            : false;

        if (hasHistoryEntry) {
            navigate(-1);
            return;
        }

        navigate(fallbackTo, { replace: true });
    }, [fallbackTo, from, location.pathname, location.search, navigate]);

    return {
        from,
        goBack,
    };
}
