export interface TraceabilityStats {
    totalStories: number;
    coveredStories: number;
    coverageRate: number;
}

export interface TraceabilityBug {
    id: string;
    title: string;
    severity: string;
    status: string;
}

export interface TraceabilityTestCase {
    id: string;
    title: string;
    status: string;
    lastExecution: {
        status: string;
        executedAt: string;
        runId: string;
    } | null;
    bugs: TraceabilityBug[];
}

export interface TraceabilityStory {
    id: string;
    title: string;
    status: string;
    priority: string;
    bugs: TraceabilityBug[];
    testCases: TraceabilityTestCase[];
}

export interface TraceabilityEpic {
    id: string;
    title: string;
    stories: TraceabilityStory[];
}

export interface TraceabilityResponse {
    matrix: TraceabilityEpic[];
    stats: TraceabilityStats;
}
