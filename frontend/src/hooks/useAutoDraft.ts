import { useEffect, useState } from "react";

type StoredDraft<T> = {
    version: 1;
    data: T;
    savedAt: string;
};

export function readAutoDraft<T>(key: string): StoredDraft<T> | null {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as StoredDraft<T> | null;
        if (!parsed || parsed.version !== 1 || !parsed.data || typeof parsed.savedAt !== "string") return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearAutoDraft(key: string) {
    window.localStorage.removeItem(key);
}

export function useAutoDraft<T>({
    key,
    value,
    enabled,
    delay = 800,
}: {
    key: string;
    value: T;
    enabled: boolean;
    delay?: number;
}) {
    const [savedAt, setSavedAt] = useState<string | null>(() => readAutoDraft<T>(key)?.savedAt ?? null);
    const serializedValue = JSON.stringify(value);

    useEffect(() => {
        if (!enabled) return;
        const timer = window.setTimeout(() => {
            const nextSavedAt = new Date().toISOString();
            const stored: StoredDraft<T> = { version: 1, data: JSON.parse(serializedValue) as T, savedAt: nextSavedAt };
            window.localStorage.setItem(key, JSON.stringify(stored));
            setSavedAt(nextSavedAt);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [delay, enabled, key, serializedValue]);

    const clear = () => {
        clearAutoDraft(key);
        setSavedAt(null);
    };

    return { savedAt, isSaving: false, clear };
}
