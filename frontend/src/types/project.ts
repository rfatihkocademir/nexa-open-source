export interface Project {
    id: string;
    key: string;
    name: string;
    description?: string;
    status: 'ACTIVE' | 'ARCHIVED';
    createdAt: string;
    updatedAt: string;
    primaryTeamId?: string | null;
    primaryTeam?: { id: string; name: string; slug: string } | null;
    _count?: {
        testRuns: number;
        suites: number;
        testCases: number;
    };
    members?: {
        user: {
            id: string;
            firstName: string;
            lastName: string;
            role: 'ADMIN' | 'TEAM_LEADER' | 'TESTER';
            email: string;
        }
    }[];
}

export interface CreateProjectInput {
    name: string;
    description?: string;
    scope?: string;
    architecture?: string;
    memberIds?: string[];
    primaryTeamId?: string;
    wikiContent?: string;
    documentationSuite?: {
        scope?: string;
        testStrategy?: string;
        automationStrategy?: string;
        releasePolicy?: string;
        architecture?: string;
    };
}

export interface UpdateProjectInput {
    name?: string;
    description?: string;
    primaryTeamId?: string | null;
}
