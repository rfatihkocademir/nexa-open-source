export interface BusinessRequestStory {
    title: string;
    description: string;
    points: number;
    acceptanceCriteria?: string;
    priority?: string;
}

export interface BusinessRequestEpic {
    title: string;
    description: string;
    reasoning?: string;
    stories?: BusinessRequestStory[];
}

export interface BusinessRequestAnalysis {
    status: 'NEEDS_INFO' | 'COMPLETE';
    questions?: string[];
    epics?: BusinessRequestEpic[];
    open_questions_and_assumptions?: string[];
    epic_structure?: BusinessRequestEpic[];
}

export interface BusinessRequest {
    id: string;
    title: string;
    content: string;
    status: 'DRAFT' | 'ANALYZED' | 'APPROVED' | 'REJECTED';
    aiAnalysis?: BusinessRequestAnalysis;
    projectId: string;
    authorId: string;
    author?: {
        firstName: string;
        lastName: string;
    };
    workItems?: Array<{
        id: string;
        title: string;
        itemType: 'EPIC' | 'STORY' | 'TASK' | 'BUG';
        status: string;
        priority?: string;
        parentId?: string | null;
        createdAt: string;
        testCases?: Array<{
            id: string;
            title?: string;
            status: string;
            runItems?: Array<{
                id: string;
                finalStatus: string;
                testRunId: string;
                testRun?: {
                    id: string;
                    title: string;
                    status: string;
                    createdAt: string;
                };
            }>;
        }>;
    }>;
    releaseCandidates?: Array<{
        id: string;
        key: string;
        title: string;
        status: 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
        label?: string | null;
        readinessScore?: number | null;
        createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessRequestGuidance {
    recommendation: 'READY' | 'CONDITIONAL' | 'NOT_READY';
    summary: string;
    confidence: number;
    topRisks: string[];
    highlights: string[];
    nextActions: Array<{
        label: string;
        href: string;
        detail: string;
    }>;
}

export interface CreateBusinessRequestInput {
    title: string;
    content: string;
}

export interface UpdateBusinessRequestInput {
    title?: string;
    content?: string;
}
