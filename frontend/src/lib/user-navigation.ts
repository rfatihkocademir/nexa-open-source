export type UserNavigationEntry = {
    path: string;
    label: string;
    context?: string;
    visitedAt: number;
};

const RECENT_KEY = "nexa-recent-locations";
const FAVORITES_KEY = "nexa-favorite-locations";
const MAX_RECENT = 12;
export const USER_NAVIGATION_CHANGED_EVENT = "nexa:user-navigation-changed";

function readEntries(key: string): UserNavigationEntry[] {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
        if (!Array.isArray(value)) return [];
        return value.filter((entry): entry is UserNavigationEntry =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as UserNavigationEntry).path === "string" &&
            typeof (entry as UserNavigationEntry).label === "string" &&
            typeof (entry as UserNavigationEntry).visitedAt === "number"
        );
    } catch {
        return [];
    }
}

function writeEntries(key: string, entries: UserNavigationEntry[]) {
    window.localStorage.setItem(key, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(USER_NAVIGATION_CHANGED_EVENT));
}

export function getRecentLocations() {
    return readEntries(RECENT_KEY);
}

export function rememberLocation(entry: UserNavigationEntry) {
    const normalizedPath = entry.path || "/";
    const entries = readEntries(RECENT_KEY).filter((item) => item.path !== normalizedPath);
    writeEntries(RECENT_KEY, [{ ...entry, path: normalizedPath }, ...entries].slice(0, MAX_RECENT));
}

export type UserNavigationTarget = Omit<UserNavigationEntry, "visitedAt">;

export function getFavoriteLocations() {
    return readEntries(FAVORITES_KEY);
}

export function isFavoriteLocation(path: string) {
    return readEntries(FAVORITES_KEY).some((entry) => entry.path === path);
}

export function toggleFavoriteLocation(entry: UserNavigationTarget) {
    const entries = readEntries(FAVORITES_KEY);
    const exists = entries.some((item) => item.path === entry.path);
    writeEntries(
        FAVORITES_KEY,
        exists ? entries.filter((item) => item.path !== entry.path) : [{ ...entry, visitedAt: Date.now() }, ...entries]
    );
    return !exists;
}
