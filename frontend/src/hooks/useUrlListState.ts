import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useUrlListState() {
    const [searchParams, setSearchParams] = useSearchParams();

    const getString = useCallback(
        (key: string, fallback = "") => searchParams.get(key) || fallback,
        [searchParams]
    );

    const getNumber = useCallback(
        (key: string, fallback: number) => {
            const parsed = Number(searchParams.get(key));
            return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
        },
        [searchParams]
    );

    const setValue = useCallback((key: string, value: string | number | null | undefined, defaultValue?: string | number) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (value === null || value === undefined || value === "" || value === defaultValue) next.delete(key);
            else next.set(key, String(value));
            if (key !== "page") next.delete("page");
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setValues = useCallback((
        updates: Record<string, string | number | null | undefined>,
        defaults: Record<string, string | number> = {}
    ) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === undefined || value === "" || value === defaults[key]) next.delete(key);
                else next.set(key, String(value));
            });
            if (!Object.prototype.hasOwnProperty.call(updates, "page")) next.delete("page");
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    return { searchParams, getString, getNumber, setValue, setValues };
}
