export interface TestSuite {
    id: string;
    name: string;
    description?: string;
    projectId: string;
    parentId?: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    _count?: {
        testCases: number;
        children: number;
    };
    children?: TestSuite[];
}

export interface CreateSuiteInput {
    name: string;
    description?: string;
    projectId: string;
    parentId?: string;
}

export interface UpdateSuiteInput {
    name?: string;
    description?: string;
    parentId?: string;
}
