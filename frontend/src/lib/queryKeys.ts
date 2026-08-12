export const queryKeys = {
    projects: {
        all: ['projects'] as const,
        list: (filters?: unknown) => ['projects', 'list', filters ?? {}] as const,
        selector: ['projects', 'selector'] as const,
        detail: (projectId?: string) => ['projects', 'detail', projectId] as const,
    },
    dashboard: {
        overview: ['dashboard', 'overview'] as const,
        myWork: ['dashboard', 'my-work'] as const,
        recentActivities: ['dashboard', 'recent-activities'] as const,
        management: (projectId: string, timeframe: string) => ['dashboard', 'management', projectId, timeframe] as const,
        performance: (projectId: string, timeframe: string) => ['dashboard', 'performance', projectId, timeframe] as const,
    },
    agile: {
        board: (projectId?: string, sprintId?: string) => ['agile-board', projectId, sprintId ?? 'active'] as const,
        stories: (projectId?: string, includeDeleted = false) => ['stories', projectId, includeDeleted] as const,
        sprints: (projectId?: string) => ['sprints', projectId] as const,
        epics: (projectId?: string) => ['epics', projectId] as const,
    },
    testSuites: (projectId?: string, includeDeleted = false) => ['test-suites', projectId, includeDeleted] as const,
    testCases: (suiteId?: string, includeDeleted = false) => ['test-cases', suiteId, includeDeleted] as const,
    testRuns: (projectId?: string) => ['test-runs', projectId] as const,
    resources: {
        detail: (key?: string) => ['resource', key] as const,
        project: (key?: string) => ['project-resource', key] as const,
    },
    actionCenter: {
        summary: ['action-center', 'summary'] as const,
    },
} as const;
