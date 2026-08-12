export const PROJECT_SECTIONS = [
    "backlog",
    "board",
    "bugs",
    "milestones",
    "tests",
    "runs",
    "automation",
    "traceability",
    "timesheet",
    "quality",
    "wiki",
    "memory",
    "ai",
    "releases",
    "settings",
] as const;

export type ProjectSection = typeof PROJECT_SECTIONS[number];

export type ProjectTab =
    | "overview"
    | "backlog"
    | "board"
    | "bugs"
    | "milestones"
    | "test-cases"
    | "runs"
    | "automation"
    | "traceability"
    | "timesheet"
    | "quality"
    | "wiki"
    | "project-memory"
    | "ai-analyst"
    | "releases"
    | "settings";

const sectionToTab: Record<ProjectSection, ProjectTab> = {
    backlog: "backlog",
    board: "board",
    bugs: "bugs",
    milestones: "milestones",
    tests: "test-cases",
    runs: "runs",
    automation: "automation",
    traceability: "traceability",
    timesheet: "timesheet",
    quality: "quality",
    wiki: "wiki",
    memory: "project-memory",
    ai: "ai-analyst",
    releases: "releases",
    settings: "settings",
};

const tabToSection: Record<Exclude<ProjectTab, "overview">, ProjectSection> = {
    backlog: "backlog",
    board: "board",
    bugs: "bugs",
    milestones: "milestones",
    "test-cases": "tests",
    runs: "runs",
    automation: "automation",
    traceability: "traceability",
    timesheet: "timesheet",
    quality: "quality",
    wiki: "wiki",
    "project-memory": "memory",
    "ai-analyst": "ai",
    releases: "releases",
    settings: "settings",
};

export function isProjectSection(value: string | undefined): value is ProjectSection {
    return !!value && (PROJECT_SECTIONS as readonly string[]).includes(value);
}

export function projectTabFromSection(section?: string): ProjectTab | null {
    if (!section) return "overview";
    return isProjectSection(section) ? sectionToTab[section] : null;
}

export function projectSectionFromTab(tab?: string | null): ProjectSection | null {
    if (!tab || tab === "overview") return null;
    return tab in tabToSection ? tabToSection[tab as Exclude<ProjectTab, "overview">] : null;
}

function withQuery(path: string, params?: URLSearchParams | Record<string, string | null | undefined>) {
    if (!params) return path;
    const search = params instanceof URLSearchParams ? new URLSearchParams(params) : new URLSearchParams();
    if (!(params instanceof URLSearchParams)) {
        Object.entries(params).forEach(([key, value]) => {
            if (value) search.set(key, value);
        });
    }
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}

export const appRoutes = {
    dashboard: () => "/dashboard",
    dashboards: () => "/dashboards",
    inbox: () => "/inbox",
    projects: () => "/projects",
    resource: (key: string) => `/b/${encodeURIComponent(key)}`,
    canonicalProject: (teamSlug: string, projectSlug: string) => `/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectSlug)}`,
    canonicalProjectSection: (teamSlug: string, projectSlug: string, section: ProjectSection, params?: URLSearchParams | Record<string, string | null | undefined>) =>
        withQuery(`/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectSlug)}/${section}`, params),
    canonicalResource: (teamSlug: string, projectSlug: string, type: string, key: string, titleSlug?: string | null) =>
        `/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(type)}/${encodeURIComponent(key)}${titleSlug ? `/${encodeURIComponent(titleSlug)}` : ''}`,
    project: (key: string) => `/p/${encodeURIComponent(key)}`,
    projectSection: (key: string, section: ProjectSection, params?: URLSearchParams | Record<string, string | null | undefined>) =>
        withQuery(`/p/${encodeURIComponent(key)}/${section}`, params),
    projectTab: (key: string, tab: ProjectTab, params?: URLSearchParams | Record<string, string | null | undefined>) => {
        const section = projectSectionFromTab(tab);
        return section ? appRoutes.projectSection(key, section, params) : withQuery(appRoutes.project(key), params);
    },
} as const;
