export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REVISE';
export type StepType = 'MANUAL' | 'WEB' | 'MOBILE';
export type AutomationScenarioStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

export interface Step {
    id?: string;
    action: string;
    expected: string;
    expectedResult?: string;
    type?: StepType;
    actionType?: string;
    locator?: string;
    data?: string;
    order?: number;
}

export interface TestCase {
    id: string;
    key: string;
    sequenceNumber: number;
    title: string;
    description?: string;
    preconditions?: string;
    steps?: Step[];
    hasSteps?: boolean;
    priority: Priority;
    status: CaseStatus;
    suiteId?: string;
    projectId?: string;
    authorId: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    author?: {
        firstName: string;
        lastName: string;
    };
    suite?: {
        name: string;
        projectId: string;
    };
    automationScenarios?: {
        id: string;
        status: AutomationScenarioStatus;
        version: number;
        updatedAt: string;
        steps?: { id: string }[];
    }[];
    tags?: { tag: Tag }[];
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    projectId: string;
}

export interface CreateTestCaseInput {
    title: string;
    description?: string;
    preconditions?: string;
    steps: Step[];
    priority?: Priority;
    suiteId?: string;
    projectId?: string;
}

export interface UpdateTestCaseInput {
    title?: string;
    description?: string;
    preconditions?: string;
    steps?: Step[];
    priority?: Priority;
    status?: CaseStatus;
    suiteId?: string;
}
