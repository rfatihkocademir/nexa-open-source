export type ReleaseStatus = 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
export type DecisionType = 'SCOPE' | 'DELIVERY' | 'QUALITY' | 'RELEASE' | 'RISK';
export type DecisionOutcome = 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_MORE_INFO';
export type ProjectQualityTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
export type QualityGateResult = 'READY' | 'CONDITIONAL' | 'BLOCKED';
export type StakeholderDecision = 'APPROVE' | 'APPROVE_WITH_RESERVATION' | 'REJECT' | 'ABSTAIN';

export interface ReleaseGovernanceState {
    preview: {
        qualityResult: QualityGateResult;
        metrics: {
            total: number; executed: number; passed: number; failed: number; blocked: number; conflicts: number; passRate: number; executionRate: number; openBugs: number; criticalOpenBugs: number; highOpenBugs: number; mediumOpenBugs: number; lowOpenBugs: number;
            dimensions: { qualityScore: number; rawPassRate: number; passConfidenceLower: number; passConfidenceUpper: number; executionRate: number; coverageRate: number; traceabilityRate: number; defectIntegrity: number; evidenceConfidence: number; defectRiskPoints: number };
            trend: { sampleSize: number; slope: number; ewma: number; direction: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'INSUFFICIENT_DATA'; volatility: number };
        };
        blockers: string[];
        warnings: string[];
        policy: { minPassRate: number; minPassConfidence: number; minQualityScore: number; minExecutionRate: number; blockHighBugs: boolean };
        manifest: { project: { qualityTier: ProjectQualityTier }; workItems: Array<{ id: string; key: string; title: string; itemType: string; status: string }>; testRuns: Array<{ id: string; key: string; title: string; status: string }> };
        scopeHash: string;
    };
    latestRound: null | {
        id: string; roundNumber: number; status: 'AWAITING_CONSENSUS' | 'CONSENSUS_REACHED' | 'REJECTED' | 'INVALIDATED'; requiredStakeholderIds: string[];
        scopeSnapshot: { scopeHash: string; qualityResult: QualityGateResult };
        decisions: Array<{ id: string; userId: string; decision: StakeholderDecision; rationale: string; updatedAt: string; user: { id: string; firstName: string; lastName: string; email: string } }>;
    };
    stakeholders: Array<{ id: string; firstName: string; lastName: string; email: string }>;
    packages: Array<{ id: string; packageNumber: number; status: string; packageHash: string; createdAt: string; manifest: { workItems?: Array<{ id: string; key: string; title: string; itemType: string; status: string }>; testRuns?: Array<{ id: string; key: string; title: string; status: string }> }; createdBy: { id: string; firstName: string; lastName: string } }>;
}

export interface ReleaseDecisionRecord {
    id: string;
    type: DecisionType;
    outcome: DecisionOutcome;
    rationale?: string | null;
    confidence?: number | null;
    createdAt: string;
    updatedAt: string;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export interface ReleaseCandidate {
    id: string;
    key: string;
    sequenceNumber: number;
    projectId: string;
    title: string;
    summary?: string | null;
    status: ReleaseStatus;
    label?: string | null;
    readinessScore?: number | null;
    totalWorkItems: number;
    completedWorkItems: number;
    openBugs: number;
    criticalOpenBugs: number;
    approvedTestCases: number;
    totalTestCases: number;
    openRuns: number;
    failedRunItems: number;
    blockedRunItems: number;
    conflictRunItems: number;
    traceabilityGaps: number;
    linkedCommits?: number;
    openPullRequests?: number;
    mergedPullRequests?: number;
    openFollowUpItems?: number;
    completedFollowUpItems?: number;
    createdAt: string;
    updatedAt: string;
    decisions?: ReleaseDecisionRecord[];
    followUps?: Array<{
        id: string;
        sourceActionType: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
        sourceActionFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'open-prs';
        createdAt: string;
        createdBy?: {
            id: string;
            firstName: string;
            lastName: string;
        };
        workItem: {
            id: string;
            title: string;
            itemType: 'BUG' | 'STORY' | 'TASK' | 'EPIC';
            status: string;
            priority?: string | null;
        };
    }>;
    runLinks?: Array<{
        testRun: {
            id: string;
            title: string;
            status: string;
        };
    }>;
    sourceRequest?: {
        id: string;
        title: string;
        status: string;
    } | null;
}

export interface CreateReleaseCandidateInput {
    title: string;
    summary?: string;
    label?: string;
    sprintId?: string;
    milestoneId?: string;
    sourceRequestId?: string;
    testRunIds?: string[];
}

export interface ReleaseAISummary {
    summary: string;
    recommendation: 'READY' | 'CONDITIONAL' | 'NOT_READY';
    confidence: number;
    topRisks: string[];
    highlights: string[];
    nextActions: Array<{
        type: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        title: string;
        description: string;
        actionLabel: string;
        targetTab: 'backlog' | 'runs' | 'traceability' | 'releases';
        targetFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
    }>;
}

export interface CreateReleaseFollowUpInput {
    itemType: 'BUG' | 'STORY' | 'TASK';
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceActionType: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
    sourceActionFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
}
