import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { rememberLocation } from "@/lib/user-navigation";

const STATIC_LABEL_KEYS: Array<[RegExp, string]> = [
    [/^\/dashboard$/, "common.dashboard"],
    [/^\/projects$/, "common.projects"],
    [/^\/runs(?:\/|$)/, "common.test_runs"],
    [/^\/milestones(?:\/|$)/, "common.milestones"],
    [/^\/reports(?:\/|$)/, "common.reports"],
    [/^\/admin\/users$/, "common.users"],
    [/^\/profile$|^\/settings$/, "common.profile"],
];

function humanizeSegment(segment: string) {
    return decodeURIComponent(segment)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function NavigationMemory() {
    const location = useLocation();
    const { t } = useTranslation();
    const path = `${location.pathname}${location.search}`;

    const entry = useMemo(() => {
        const staticMatch = STATIC_LABEL_KEYS.find(([pattern]) => pattern.test(location.pathname));
        const segments = location.pathname.split("/").filter(Boolean);
        const lastSegment = segments.at(-1) || t("common.dashboard");
        const projectMatch = location.pathname.match(/^\/p\/([^/]+)(?:\/([^/]+))?/);
        const resourceMatch = location.pathname.match(/^\/b\/([^/]+)/);
        const canonicalMatch = location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/);

        if (projectMatch) {
            const projectKey = decodeURIComponent(projectMatch[1]);
            const section = projectMatch[2] ? humanizeSegment(projectMatch[2]) : t("project_details.overview");
            return { path, label: `${projectKey} · ${section}`, context: t("common.projects") };
        }

        if (resourceMatch) {
            return { path, label: decodeURIComponent(resourceMatch[1]), context: t("common.details", "Detay") };
        }

        if (canonicalMatch) {
            const [, team, project, typeOrSection, resourceKey] = canonicalMatch;
            return {
                path,
                label: resourceKey ? decodeURIComponent(resourceKey) : `${humanizeSegment(project)} · ${typeOrSection ? humanizeSegment(typeOrSection) : t("project_details.overview")}`,
                context: `${humanizeSegment(team)} · ${humanizeSegment(project)}`,
            };
        }

        return {
            path,
            label: staticMatch ? t(staticMatch[1]) : humanizeSegment(lastSegment),
            context: segments.length > 1 ? humanizeSegment(segments.at(-2)!) : undefined,
        };
    }, [location.pathname, path, t]);

    useEffect(() => {
        if (
            location.pathname.startsWith("/login") ||
            location.pathname.startsWith("/auth/") ||
            location.pathname === "/403"
        ) return;
        rememberLocation({ ...entry, visitedAt: Date.now() });
    }, [entry, location.pathname]);

    return null;
}
