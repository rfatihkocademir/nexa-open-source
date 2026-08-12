export type MockRole =
  | 'ADMIN'
  | 'TESTER'
  | 'TEAM_LEADER'
  | 'PRODUCT_OWNER'
  | 'SCRUM_MASTER'
  | 'DEVELOPER'
  | 'ANALYST';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type RunStatus = 'OPEN' | 'COMPLETED' | 'ARCHIVED';
export type RunEnvironment = 'DEV' | 'QA' | 'PREPROD' | 'PROD';
export type ResultStatus = 'UNTESTED' | 'PASS' | 'FAIL' | 'RETEST' | 'BLOCK' | 'CONFLICT';

export interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MockRole;
  isActive: boolean;
  avatarUrl?: string | null;
}

export interface MockProjectMember {
  user: Pick<MockUser, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'isActive'>;
}

export interface MockProject {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  _count: {
    suites: number;
    testCases: number;
    testRuns: number;
    members: number;
  };
  testRuns?: Array<{ id: string }>;
  members: MockProjectMember[];
}

export interface MockTag {
  id: string;
  name: string;
  color: string;
  projectId: string;
}

export interface MockTestSuite {
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
  children?: MockTestSuite[];
}

export interface MockTestCase {
  id: string;
  title: string;
  description?: string;
  preconditions?: string;
  steps?: Array<{
    id?: string;
    action: string;
    expected: string;
    expectedResult?: string;
    type?: 'MANUAL' | 'WEB' | 'MOBILE';
    actionType?: string;
    locator?: string;
    data?: string;
    order?: number;
  }>;
  hasSteps?: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REVISE';
  suiteId: string;
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
  tags?: { tag: MockTag }[];
}

export interface MockMilestone {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  status: RunStatus;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
  testRuns?: Array<{
    id: string;
    title: string;
    status: RunStatus;
    environment: RunEnvironment | string;
    createdAt: string;
    items: Array<{
      finalStatus: ResultStatus;
    }>;
    _count: {
      items: number;
    };
  }>;
  _count?: {
    testRuns: number;
  };
}

export interface MockTestRunItem {
  id: string;
  testRunId: string;
  testCaseId: string;
  manualStatus: ResultStatus;
  automationStatus?: ResultStatus;
  finalStatus: ResultStatus;
  assigneeId?: string;
  testCase: {
    id: string;
    title: string;
    priority: string;
  };
  assignee?: {
    firstName: string;
    lastName: string;
  };
  results?: Array<{
    id: string;
    runItemId: string;
    status: ResultStatus;
    duration?: number;
    comment?: string;
    evidenceUrl?: string;
    testerId: string;
    createdAt: string;
    stepResults?: Array<{
      stepIndex: number;
      status: ResultStatus;
      comment?: string;
    }>;
  }>;
  caseTitle?: string;
  caseSteps?: Array<{
    action: string;
    expected: string;
    expectedResult?: string;
    name?: string;
  }>;
  casePreconditions?: string;
  casePriority?: string;
  videoUrl?: string;
  errorOutput?: string;
}

export interface MockTestRun {
  id: string;
  title: string;
  projectId?: string;
  milestoneId?: string;
  creatorId: string;
  creator?: {
    firstName: string;
    lastName: string;
  };
  status: RunStatus;
  environment: RunEnvironment;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  untestedCount: number;
  milestone?: {
    name: string;
  };
  project?: {
    name: string;
  };
  items?: MockTestRunItem[];
  _count: {
    items: number;
  };
}

export interface MockRunReport {
  id: string;
  summary: Array<{
    name: 'Passed' | 'Failed' | 'Blocked' | 'Skipped' | 'Untested';
    value: number;
    color: string;
  }>;
  metrics: {
    totalCases: number;
    passRate: string;
    duration: string;
  };
  cases: Array<{
    id: string;
    title: string;
    status: 'Passed' | 'Failed' | 'Blocked' | 'Skipped' | 'Untested';
    duration: string;
    assignee: string;
    error?: string;
  }>;
}

export interface MockDashboardStats {
  sprint: null | {
    id: string;
    name: string;
    goal: string | null;
    startDate: string | null;
    endDate: string | null;
    totalPoints: number;
    completedPoints: number;
    progress: number;
    daysRemaining: number;
  };
  stories: {
    total: number;
    byStatus: Record<string, number>;
  };
  bugs: {
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
  testCases: {
    total: number;
    byStatus: Record<string, number>;
  };
  testRuns: {
    total: number;
    active: number;
  };
  execution: {
    byStatus: Record<string, number>;
  };
}

export interface MockManagementMetrics {
  timeframe: 'WEEK' | 'SPRINT' | 'MONTH';
  period: { start: string; end: string };
  qgi: number;
  passRate: number;
  failRate: number;
  retestRate: number;
  conflictRate: number;
  velocity: number;
  defectTrend: number;
  nextActions?: Array<{
    type: string;
    metric: string;
    value: number;
    suggestion: string;
  }>;
}

export interface MockPerformanceRow {
  testerId: string;
  name: string;
  total: number;
  passRate: number;
  failRate: number;
  retestRate: number;
  blockRate: number;
  velocity: number;
  avgDurationMs: number;
}

export interface MockRecentActivity {
  id: string;
  type: 'RUN_CREATED' | 'TEST_EXECUTED' | 'CASE_UPDATED';
  description: string;
  user: string;
  project: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface MockNotificationList {
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    read: boolean;
    createdAt: string;
    data?: Record<string, unknown>;
  }>;
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

export interface MockBusinessRequest {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'ANALYZED' | 'APPROVED' | 'REJECTED';
  aiAnalysis?: {
    status: 'NEEDS_INFO' | 'COMPLETE';
    questions?: string[];
    epics?: Array<{
      title: string;
      description: string;
      reasoning?: string;
      stories?: Array<{
        title: string;
        description: string;
        points: number;
        acceptanceCriteria?: string;
        priority?: string;
      }>;
    }>;
  };
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
    title: string;
    status: 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
    label?: string | null;
    readinessScore?: number | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface MockBusinessRequestGuidance {
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

export interface MockIntegration {
  id: string;
  projectId: string;
  type: 'GITHUB' | 'GITLAB' | 'SLACK' | 'DISCORD' | 'CUSTOM_WEBHOOK';
  name: string;
  config: {
    url?: string;
    secret?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  webhooks: Array<{
    id: string;
    integrationId: string;
    event: string;
    payloadTemplate?: unknown;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface MockScenario {
  auth: {
    credentials: {
      email: string;
      password: string;
    };
    token: string;
    user: MockUser;
    projectPermissions: Record<string, string[]>;
  };
  users: MockUser[];
  projects: MockProject[];
  suitesByProjectId: Record<string, MockTestSuite[]>;
  casesBySuiteId: Record<string, MockTestCase[]>;
  milestonesByProjectId: Record<string, MockMilestone[]>;
  tagsByProjectId: Record<string, MockTag[]>;
  bugsByProjectId: Record<string, MockBug[]>;
  runs: MockTestRun[];
  reportsByRunId: Record<string, MockRunReport>;
  projectStatsById: Record<string, MockDashboardStats>;
  businessRequestsByProjectId: Record<string, MockBusinessRequest[]>;
  businessRequestGuidanceById: Record<string, MockBusinessRequestGuidance>;
  integrationsByProjectId: Record<string, MockIntegration[]>;
  wikiSpacesByProjectId: Record<string, MockWikiSpace[]>;
  wikiPagesBySpaceId: Record<string, MockWikiPage[]>;
  releasesByProjectId: Record<string, MockReleaseCandidate[]>;
  releaseAISummariesByCandidateId: Record<string, MockReleaseAISummary>;
  traceabilityByProjectId: Record<string, MockTraceabilityResponse>;
  automationStepsByProjectId: Record<string, MockAutomationStep[]>;
  automationScenariosByTestCaseId: Record<string, MockAutomationScenario>;
  testCaseAttachmentsById: Record<string, MockAttachmentMeta[]>;
  wikiPageAttachmentsById: Record<string, MockAttachmentMeta[]>;
  testResultAttachmentsById: Record<string, MockAttachmentMeta[]>;
  dashboard: {
    management: MockManagementMetrics | null;
    performance: MockPerformanceRow[];
    activities: MockRecentActivity[];
  };
  ai: {
    questions: Array<{ text: string; suggestions?: string[] }>;
    architectureQuestions: Array<{ text: string; suggestions?: string[] }>;
    documentationSuite: {
      scope: string;
      architecture: string;
      testStrategy: string;
      automationStrategy: string;
      releasePolicy: string;
    };
    architecture: string;
  };
  projectWarnings: Array<{ type: string; message: string; projectId: string }>;
  notifications: MockNotificationList;
}

export interface MockAttachmentMeta {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  objectKey: string;
  category: string;
  createdAt: string;
}

export interface MockBug {
  id: string;
  title: string;
  description?: string;
  stepsToReproduce?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  projectId: string;
  storyId?: string;
  testResultId?: string;
  foundInEnv?: RunEnvironment;
  createdAt: string;
  updatedAt: string;
}

export interface MockWikiSpace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  projectId: string;
  _count?: {
    pages: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MockWikiPage {
  id: string;
  title: string;
  content?: unknown;
  spaceId: string;
  parentId?: string;
  children?: MockWikiPage[];
  authorId: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type MockReleaseStatus = 'DRAFT' | 'READY' | 'RELEASED' | 'CANCELLED';
export type MockDecisionType = 'SCOPE' | 'DELIVERY' | 'QUALITY' | 'RELEASE' | 'RISK';
export type MockDecisionOutcome = 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_MORE_INFO';

export interface MockReleaseDecision {
  id: string;
  type: MockDecisionType;
  outcome: MockDecisionOutcome;
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

export interface MockReleaseCandidate {
  id: string;
  title: string;
  summary?: string | null;
  status: MockReleaseStatus;
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
  decisions?: MockReleaseDecision[];
  followUps?: Array<{
    id: string;
    sourceActionType: 'BUG' | 'RUN' | 'COVERAGE' | 'TRACEABILITY' | 'DECISION';
    sourceActionFocus: 'critical-bugs' | 'failed-runs' | 'open-runs' | 'conflicts' | 'traceability-gaps' | 'coverage-gaps' | 'follow-up-items' | 'open-prs';
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

export interface MockReleaseAISummary {
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

export interface MockTraceabilityResponse {
  matrix: Array<{
    id: string;
    title: string;
    stories: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      bugs: Array<{
        id: string;
        title: string;
        severity: string;
        status: string;
      }>;
      testCases: Array<{
        id: string;
        title: string;
        status: string;
        lastExecution: {
          status: string;
          executedAt: string;
          runId: string;
        } | null;
        bugs: Array<{
          id: string;
          title: string;
          severity: string;
          status: string;
        }>;
      }>;
    }>;
  }>;
  stats: {
    totalStories: number;
    coveredStories: number;
    coverageRate: number;
  };
}

export type MockAutomationActionType =
  | 'NAVIGATE'
  | 'CLICK'
  | 'FILL'
  | 'ASSERT_TEXT'
  | 'ASSERT_VISIBLE'
  | 'WAIT'
  | 'SELECT'
  | 'SET_COOKIE'
  | 'SET_LOCAL_STORAGE'
  | 'API_REQUEST';

export interface MockAutomationStep {
  id: string;
  name: string;
  description?: string;
  locator: string;
  actionType: MockAutomationActionType;
  data?: string;
  pageObject?: string;
  projectId: string;
  _count?: {
    scenarioSteps: number;
  };
}

export interface MockAutomationScenario {
  id: string;
  testCaseId: string;
  steps: Array<{
    id: string;
    stepId: string;
    step: MockAutomationStep;
    orderIndex: number;
  }>;
  variables?: Record<string, string>;
  title?: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  version?: number;
}

const now = Date.now();

const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60_000).toISOString();
const daysFromNow = (days: number) => new Date(now + days * 24 * 60 * 60_000).toISOString();

function createUser(id: string, firstName: string, lastName: string, role: MockRole, email: string): MockUser {
  return {
    id,
    email,
    firstName,
    lastName,
    role,
    isActive: true,
    avatarUrl: null,
  };
}

function createProject(params: {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  members: MockUser[];
  suites: number;
  testCases: number;
  testRuns: number;
}) : MockProject {
  return {
    id: params.id,
    key: params.id === 'project-sales' ? 'SALES' : params.id === 'project-ops' ? 'OPS' : params.id.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase(),
    name: params.name,
    description: params.description,
    status: params.status,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    _count: {
      suites: params.suites,
      testCases: params.testCases,
      testRuns: params.testRuns,
      members: params.members.length,
    },
    testRuns: params.testRuns > 0 ? Array.from({ length: params.testRuns }, (_, index) => ({ id: `${params.id}-run-${index + 1}` })) : [],
    members: params.members.map((user) => ({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    })),
  };
}

function createTag(params: {
  id: string;
  name: string;
  color: string;
  projectId: string;
}): MockTag {
  return params;
}

function createBug(params: {
  id: string;
  title: string;
  description?: string;
  stepsToReproduce?: string;
  severity: MockBug['severity'];
  projectId: string;
  storyId?: string;
  testResultId?: string;
  foundInEnv?: RunEnvironment;
  createdAt: string;
  updatedAt: string;
}): MockBug {
  return params;
}

function createSuite(params: {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  testCases: number;
  children?: MockTestSuite[];
  deletedAt?: string | null;
}): MockTestSuite {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    projectId: params.projectId,
    parentId: params.parentId,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    deletedAt: params.deletedAt ?? null,
    _count: {
      testCases: params.testCases,
      children: params.children?.length ?? 0,
    },
    children: params.children,
  };
}

export function createTestCase(params: {
  id: string;
  title: string;
  suite: MockTestSuite;
  author: MockUser;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REVISE';
  description?: string;
  preconditions?: string;
  hasSteps?: boolean;
  tags?: MockTag[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}): MockTestCase {
  return {
    id: params.id,
    title: params.title,
    description: params.description,
    preconditions: params.preconditions,
    hasSteps: params.hasSteps ?? true,
    priority: params.priority,
    status: params.status,
    suiteId: params.suite.id,
    authorId: params.author.id,
    version: 1,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    deletedAt: params.deletedAt ?? null,
    author: {
      firstName: params.author.firstName,
      lastName: params.author.lastName,
    },
    suite: {
      name: params.suite.name,
      projectId: params.suite.projectId,
    },
    tags: params.tags?.map((tag) => ({ tag })),
  };
}

function createMilestone(params: {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  status: RunStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  testRuns?: MockMilestone['testRuns'];
}): MockMilestone {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    dueDate: params.dueDate,
    status: params.status,
    projectId: params.projectId,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    testRuns: params.testRuns,
    _count: {
      testRuns: params.testRuns?.length ?? 0,
    },
  };
}

export function createRun(params: {
  id: string;
  title: string;
  project: MockProject;
  status: RunStatus;
  environment: RunEnvironment;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  untestedCount: number;
  milestoneName: string;
  creator: MockUser;
  items: MockTestRunItem[];
}): MockTestRun {
  return {
    id: params.id,
    title: params.title,
    projectId: params.project.id,
    creatorId: params.creatorId,
    creator: {
      firstName: params.creator.firstName,
      lastName: params.creator.lastName,
    },
    status: params.status,
    environment: params.environment,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    totalItems: params.totalItems,
    passedCount: params.passedCount,
    failedCount: params.failedCount,
    blockedCount: params.blockedCount,
    untestedCount: params.untestedCount,
    milestone: {
      name: params.milestoneName,
    },
    project: {
      name: params.project.name,
    },
    items: params.items,
    _count: {
      items: params.totalItems,
    },
  };
}

export function createReport(run: MockTestRun): MockRunReport {
  const passed = run.passedCount;
  const failed = run.failedCount;
  const blocked = run.blockedCount;
  const untested = run.untestedCount;
  const skipped = Math.max(run.totalItems - passed - failed - blocked - untested, 0);
  const statusMap: Record<ResultStatus, MockRunReport['cases'][number]['status']> = {
    PASS: 'Passed',
    FAIL: 'Failed',
    BLOCK: 'Blocked',
    UNTESTED: 'Untested',
    RETEST: 'Skipped',
    CONFLICT: 'Skipped',
  };

  return {
    id: run.id,
    summary: [
      { name: 'Passed', value: passed, color: '#10b981' },
      { name: 'Failed', value: failed, color: '#ef4444' },
      { name: 'Blocked', value: blocked, color: '#f59e0b' },
      { name: 'Skipped', value: skipped, color: '#64748b' },
      { name: 'Untested', value: untested, color: '#94a3b8' },
    ],
    metrics: {
      totalCases: run.totalItems,
      passRate: `${Math.round((passed / Math.max(run.totalItems, 1)) * 100)}%`,
      duration: '48 dk 12 sn',
    },
    cases: (run.items ?? []).map((item, index) => {
      const latestResult = item.results?.at(-1);
      const assignee = item.assignee
        ? `${item.assignee.firstName} ${item.assignee.lastName}`
        : 'Atanmamış';
      return {
        id: `${run.id}-case-${index + 1}`,
        title: item.caseTitle || item.testCase.title,
        status: statusMap[item.finalStatus],
        duration: latestResult?.duration ? `${latestResult.duration} sn` : '0 sn',
        assignee,
        error: item.errorOutput || latestResult?.comment,
      };
    }),
  };
}

function createAttachment(params: {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  objectKey: string;
  category: string;
  createdAt: string;
}): MockAttachmentMeta {
  return params;
}

function createWikiSpace(params: {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  pages?: number;
}): MockWikiSpace {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    icon: params.icon,
    projectId: params.projectId,
    _count: {
      pages: params.pages ?? 0,
    },
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

export function createWikiPage(params: {
  id: string;
  title: string;
  content?: unknown;
  spaceId: string;
  parentId?: string;
  author: MockUser;
  version: number;
  createdAt: string;
  updatedAt: string;
  children?: MockWikiPage[];
}): MockWikiPage {
  return {
    id: params.id,
    title: params.title,
    content: params.content,
    spaceId: params.spaceId,
    parentId: params.parentId,
    children: params.children,
    authorId: params.author.id,
    author: {
      id: params.author.id,
      firstName: params.author.firstName,
      lastName: params.author.lastName,
      email: params.author.email,
    },
    version: params.version,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

export function createReleaseDecision(params: {
  id: string;
  type: MockDecisionType;
  outcome: MockDecisionOutcome;
  rationale?: string | null;
  confidence?: number | null;
  createdAt: string;
  updatedAt: string;
  author?: MockUser;
}): MockReleaseDecision {
  return {
    id: params.id,
    type: params.type,
    outcome: params.outcome,
    rationale: params.rationale ?? null,
    confidence: params.confidence ?? null,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    author: params.author
      ? {
          id: params.author.id,
          firstName: params.author.firstName,
          lastName: params.author.lastName,
        }
      : undefined,
  };
}

export function createReleaseCandidate(params: {
  id: string;
  title: string;
  summary?: string | null;
  status: MockReleaseStatus;
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
  decisions?: MockReleaseDecision[];
  followUps?: MockReleaseCandidate['followUps'];
  runLinks?: MockReleaseCandidate['runLinks'];
  sourceRequest?: MockReleaseCandidate['sourceRequest'];
}): MockReleaseCandidate {
  return {
    id: params.id,
    title: params.title,
    summary: params.summary ?? null,
    status: params.status,
    label: params.label ?? null,
    readinessScore: params.readinessScore ?? null,
    totalWorkItems: params.totalWorkItems,
    completedWorkItems: params.completedWorkItems,
    openBugs: params.openBugs,
    criticalOpenBugs: params.criticalOpenBugs,
    approvedTestCases: params.approvedTestCases,
    totalTestCases: params.totalTestCases,
    openRuns: params.openRuns,
    failedRunItems: params.failedRunItems,
    blockedRunItems: params.blockedRunItems,
    conflictRunItems: params.conflictRunItems,
    traceabilityGaps: params.traceabilityGaps,
    linkedCommits: params.linkedCommits,
    openPullRequests: params.openPullRequests,
    mergedPullRequests: params.mergedPullRequests,
    openFollowUpItems: params.openFollowUpItems,
    completedFollowUpItems: params.completedFollowUpItems,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    decisions: params.decisions,
    followUps: params.followUps,
    runLinks: params.runLinks,
    sourceRequest: params.sourceRequest ?? null,
  };
}

function createAutomationStep(params: {
  id: string;
  name: string;
  description?: string;
  locator: string;
  actionType: MockAutomationActionType;
  data?: string;
  pageObject?: string;
  projectId: string;
  scenarioSteps?: number;
}): MockAutomationStep {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    locator: params.locator,
    actionType: params.actionType,
    data: params.data,
    pageObject: params.pageObject,
    projectId: params.projectId,
    _count: {
      scenarioSteps: params.scenarioSteps ?? 0,
    },
  };
}

function createAutomationScenario(params: {
  id: string;
  testCaseId: string;
  steps: Array<{
    id: string;
    stepId: string;
    step: MockAutomationStep;
    orderIndex: number;
  }>;
  variables?: Record<string, string>;
  status?: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  version?: number;
}): MockAutomationScenario {
  return {
    id: params.id,
    testCaseId: params.testCaseId,
    steps: params.steps,
    variables: params.variables,
    status: params.status ?? 'PUBLISHED',
    version: params.version ?? 1,
  };
}

export function createReleaseAISummary(params: MockReleaseAISummary): MockReleaseAISummary {
  return params;
}

function createTraceabilityResponse(): MockTraceabilityResponse {
  return {
    stats: {
      totalStories: 3,
      coveredStories: 2,
      coverageRate: 67,
    },
    matrix: [
      {
        id: 'epic-auth',
        title: 'Kimlik Doğrulama',
        stories: [
          {
            id: 'story-login-success',
            title: 'Kullanıcı başarılı şekilde giriş yapar',
            status: 'DONE',
            priority: 'HIGH',
            bugs: [],
            testCases: [
              {
                id: 'case-login-success',
                title: 'Kullanıcı başarılı şekilde giriş yapar',
                status: 'APPROVED',
                lastExecution: {
                  status: 'PASS',
                  executedAt: daysAgo(1),
                  runId: 'run-sprint-24',
                },
                bugs: [],
              },
            ],
          },
          {
            id: 'story-login-fail',
            title: 'Hatalı parola reddedilir',
            status: 'IN_PROGRESS',
            priority: 'CRITICAL',
            bugs: [
              {
                id: 'bug-login-copy',
                title: 'Hata mesajı metni düzeltilmeli',
                severity: 'LOW',
                status: 'OPEN',
              },
            ],
            testCases: [],
          },
        ],
      },
      {
        id: 'epic-payments',
        title: 'Ödeme Akışları',
        stories: [
          {
            id: 'story-payment-approved',
            title: 'Ödeme onayı tamamlanır',
            status: 'DONE',
            priority: 'HIGH',
            bugs: [],
            testCases: [
              {
                id: 'case-payment-approved',
                title: 'Ödeme onayı tamamlanır',
                status: 'REVISE',
                lastExecution: {
                  status: 'FAIL',
                  executedAt: daysAgo(2),
                  runId: 'run-payments-01',
                },
                bugs: [
                  {
                    id: 'bug-payment-timeout',
                    title: 'Ödeme onayı zaman aşımına düşüyor',
                    severity: 'HIGH',
                    status: 'OPEN',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function emptyNotificationList(): MockNotificationList {
  return {
    notifications: [],
    total: 0,
    unreadCount: 0,
    page: 1,
    totalPages: 1,
  };
}

export function createMockWorkspaceScenario(role: 'TEAM_LEADER' | 'TESTER' | 'ADMIN'): MockScenario {
  const leader = createUser('user-leader', 'Ayşe', 'Demir', 'TEAM_LEADER', 'ayse.leader@nexa.test');
  const testerOne = createUser('user-tester-1', 'Deniz', 'Kaya', 'TESTER', 'deniz.kaya@nexa.test');
  const testerTwo = createUser('user-tester-2', 'Mert', 'Yılmaz', 'TESTER', 'mert.yilmaz@nexa.test');
  const admin = createUser('user-admin', 'Aylin', 'Kara', 'ADMIN', 'aylin.kara@nexa.test');

  if (role === 'TESTER') {
    const user = createUser('user-tester-live', 'Zeynep', 'Acar', 'TESTER', 'zeynep.acar@nexa.test');
    return {
      auth: {
        credentials: {
          email: user.email,
          password: 'Password123!',
        },
        token: 'mock-tester-token',
        user,
        projectPermissions: {},
      },
      users: [user],
      projects: [],
      suitesByProjectId: {},
      casesBySuiteId: {},
      milestonesByProjectId: {},
      tagsByProjectId: {},
      bugsByProjectId: {},
      runs: [],
      reportsByRunId: {},
      projectStatsById: {},
      businessRequestsByProjectId: {},
      businessRequestGuidanceById: {},
      integrationsByProjectId: {},
      wikiSpacesByProjectId: {},
      wikiPagesBySpaceId: {},
      releasesByProjectId: {},
      releaseAISummariesByCandidateId: {},
      traceabilityByProjectId: {},
      automationStepsByProjectId: {},
      automationScenariosByTestCaseId: {},
      testCaseAttachmentsById: {},
      wikiPageAttachmentsById: {},
      testResultAttachmentsById: {},
      dashboard: {
        management: null,
        performance: [],
        activities: [],
      },
      ai: {
        questions: [
          { text: 'Bu projenin birincil kullanıcıları kimlerdir?', suggestions: ['İç ekip', 'Müşteriler'] },
          { text: 'En kritik başarı ölçütü nedir?', suggestions: ['Teslim hızı', 'Hata oranı'] },
        ],
        architectureQuestions: [
          { text: 'Hangi teknoloji yığını kullanılacak?' },
          { text: 'Hangi entegrasyonlar var?' },
        ],
        documentationSuite: {
          scope: '# Kapsam\n\nBu projede kapsam dokümanı.',
          architecture: '# Mimari\n\nBu projede mimari dokümanı.',
          testStrategy: '# Test Stratejisi\n\nBu projede test stratejisi.',
          automationStrategy: '# Otomasyon Stratejisi\n\nBu projede otomasyon stratejisi.',
          releasePolicy: '# Release Politikası\n\nBu projede release politikası.',
        },
        architecture: '# Mimari\n\nManuel mimari açıklaması.',
      },
      projectWarnings: [],
      notifications: emptyNotificationList(),
    };
  }

  const activeProject = createProject({
    id: 'project-sales',
    name: 'Satış Portalı',
    description: 'Kurumsal sipariş akışı, müşteri yönetimi ve QA operasyonları.',
    status: 'ACTIVE',
    createdAt: daysAgo(16),
    updatedAt: daysAgo(1),
    members: [leader, testerOne, testerTwo],
    suites: 4,
    testCases: 24,
    testRuns: 6,
  });

  const archivedProject = createProject({
    id: 'project-ops',
    name: 'Eski Operasyon Paneli',
    description: 'Arşivlenen operasyon akışı ve geriye dönük referans ekranları.',
    status: 'ARCHIVED',
    createdAt: daysAgo(42),
    updatedAt: daysAgo(23),
    members: [leader, testerOne],
    suites: 2,
    testCases: 9,
    testRuns: 1,
  });

  const smokeTag = createTag({
    id: 'tag-smoke',
    name: 'smoke',
    color: '#0ea5e9',
    projectId: activeProject.id,
  });
  const negativeTag = createTag({
    id: 'tag-negative',
    name: 'negative',
    color: '#ef4444',
    projectId: activeProject.id,
  });
  const paymentsTag = createTag({
    id: 'tag-payments',
    name: 'payments',
    color: '#8b5cf6',
    projectId: activeProject.id,
  });

  const authSuite = createSuite({
    id: 'suite-auth',
    name: 'Kimlik Doğrulama',
    description: 'Giriş, oturum ve yetki akışları.',
    projectId: activeProject.id,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
    testCases: 2,
  });

  const paymentsSuite = createSuite({
    id: 'suite-payments',
    name: 'Ödeme Akışları',
    description: 'Ödeme onay ve hata senaryoları.',
    projectId: activeProject.id,
    createdAt: daysAgo(11),
    updatedAt: daysAgo(1),
    testCases: 2,
  });

  const authCases = [
    createTestCase({
      id: 'case-login-success',
      title: 'Kullanıcı başarılı şekilde giriş yapar',
      suite: authSuite,
      author: testerOne,
      priority: 'HIGH',
      status: 'APPROVED',
      description: 'Geçerli kimlik bilgileriyle giriş akışı.',
      preconditions: 'Kullanıcı kayıtlı ve aktif olmalıdır.',
      tags: [smokeTag],
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1),
    }),
    createTestCase({
      id: 'case-login-legacy',
      title: 'Eski giriş akışı arşivden geri getirilebilir',
      suite: authSuite,
      author: testerOne,
      priority: 'LOW',
      status: 'DRAFT',
      description: 'Arşivlenmiş bir test senaryosu geri yükleme akışını doğrular.',
      preconditions: 'Silinmiş senaryolar görünür hâle getirilmelidir.',
      createdAt: daysAgo(20),
      updatedAt: daysAgo(18),
      deletedAt: daysAgo(17),
    }),
    createTestCase({
      id: 'case-login-failed-password',
      title: 'Hatalı parola reddedilir',
      suite: authSuite,
      author: testerTwo,
      priority: 'CRITICAL',
      status: 'REVISE',
      description: 'Hatalı parola girildiğinde kullanıcı oturum açamaz.',
      preconditions: 'Kullanıcı çıkış yapmış olmalıdır.',
      tags: [negativeTag],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1),
    }),
  ];

  const paymentCases = [
    createTestCase({
      id: 'case-payment-approved',
      title: 'Ödeme onayı tamamlanır',
      suite: paymentsSuite,
      author: testerOne,
      priority: 'CRITICAL',
      status: 'APPROVED',
      description: 'Ödeme onaylandığında başarılı durum gösterilir.',
      preconditions: 'Geçerli kart ve aktif sipariş gerekir.',
      tags: [paymentsTag, smokeTag],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
    }),
    createTestCase({
      id: 'case-payment-declined',
      title: 'Reddedilen ödeme açıklama verir',
      suite: paymentsSuite,
      author: testerTwo,
      priority: 'HIGH',
      status: 'PENDING',
      description: 'Ödeme reddedildiğinde anlamlı hata döner.',
      preconditions: 'Banka reddi simüle edilmelidir.',
      tags: [negativeTag],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
    }),
  ];

  authCases[0].steps = [
    { action: 'Giriş ekranını aç', expected: 'Giriş formu görünür' },
    { action: 'Geçerli e-posta adresini gir', expected: 'E-posta alanı doldurulur' },
    { action: 'Geçerli şifreyi gir', expected: 'Şifre alanı doldurulur' },
    { action: 'Giriş yap düğmesine tıkla', expected: 'Kullanıcı paneline yönlendirilir' },
  ];
  authCases[1].steps = [
    { action: 'Giriş ekranını aç', expected: 'Giriş formu görünür' },
    { action: 'Arşivlenmiş senaryoyu seç', expected: 'Eski sürüm görünür' },
  ];
  authCases[2].steps = [
    { action: 'Giriş ekranını aç', expected: 'Giriş formu görünür' },
    { action: 'Hatalı parolayı gir', expected: 'Hata mesajı görünür' },
  ];
  paymentCases[0].steps = [
    { action: 'Ödeme ekranını aç', expected: 'Ödeme formu görünür' },
    { action: 'Kart bilgilerini doldur', expected: 'Kart alanları doldurulur' },
    { action: 'Ödemeyi onayla', expected: 'Başarı mesajı görünür' },
  ];
  paymentCases[1].steps = [
    { action: 'Ödeme ekranını aç', expected: 'Ödeme formu görünür' },
    { action: 'Reddedilen kartı kullan', expected: 'Hata açıklaması görünür' },
  ];

  const primaryRunItems: MockTestRunItem[] = [
    {
      id: 'run-sprint-24-item-1',
      testRunId: 'run-sprint-24',
      testCaseId: authCases[0].id,
      manualStatus: 'PASS',
      automationStatus: 'PASS',
      finalStatus: 'PASS',
      assigneeId: testerOne.id,
      testCase: {
        id: authCases[0].id,
        title: authCases[0].title,
        priority: authCases[0].priority,
      },
      assignee: {
        firstName: testerOne.firstName,
        lastName: testerOne.lastName,
      },
      caseTitle: authCases[0].title,
      caseSteps: [
        { action: 'E-posta adresini gir', expected: 'Kullanıcı giriş ekranında kalır' },
        { action: 'Parolayı gir', expected: 'Panel açılır' },
      ],
      casePreconditions: authCases[0].preconditions,
      casePriority: authCases[0].priority,
    },
    {
      id: 'run-sprint-24-item-2',
      testRunId: 'run-sprint-24',
      testCaseId: authCases[1].id,
      manualStatus: 'FAIL',
      automationStatus: 'PASS',
      finalStatus: 'FAIL',
      assigneeId: testerTwo.id,
      testCase: {
        id: authCases[1].id,
        title: authCases[1].title,
        priority: authCases[1].priority,
      },
      assignee: {
        firstName: testerTwo.firstName,
        lastName: testerTwo.lastName,
      },
      caseTitle: authCases[1].title,
      caseSteps: [
        { action: 'Geçersiz parola gir', expected: 'Hata bildirimi görünür' },
      ],
      casePreconditions: authCases[1].preconditions,
      casePriority: authCases[1].priority,
      errorOutput: 'Beklenen hata metni görünmedi.',
    },
    {
      id: 'run-sprint-24-item-3',
      testRunId: 'run-sprint-24',
      testCaseId: paymentCases[0].id,
      manualStatus: 'BLOCK',
      automationStatus: 'BLOCK',
      finalStatus: 'BLOCK',
      assigneeId: leader.id,
      testCase: {
        id: paymentCases[0].id,
        title: paymentCases[0].title,
        priority: paymentCases[0].priority,
      },
      assignee: {
        firstName: leader.firstName,
        lastName: leader.lastName,
      },
      caseTitle: paymentCases[0].title,
      caseSteps: [
        { action: 'Ödeme akışını başlat', expected: 'Ödeme servisi yanıt verir' },
      ],
      casePreconditions: paymentCases[0].preconditions,
      casePriority: paymentCases[0].priority,
      errorOutput: 'Websocket bağlantısı nedeniyle test askıya alındı.',
    },
    {
      id: 'run-sprint-24-item-4',
      testRunId: 'run-sprint-24',
      testCaseId: paymentCases[1].id,
      manualStatus: 'UNTESTED',
      finalStatus: 'UNTESTED',
      assigneeId: leader.id,
      testCase: {
        id: paymentCases[1].id,
        title: paymentCases[1].title,
        priority: paymentCases[1].priority,
      },
      assignee: {
        firstName: leader.firstName,
        lastName: leader.lastName,
      },
      caseTitle: paymentCases[1].title,
      caseSteps: [
        { action: 'Reddedilen ödemeyi yeniden dene', expected: 'Uyarı mesajı kalır' },
      ],
      casePreconditions: paymentCases[1].preconditions,
      casePriority: paymentCases[1].priority,
    },
  ];

  const primaryRun = createRun({
    id: 'run-sprint-24',
    title: 'Sprint 24 Regresyon',
    project: activeProject,
    status: 'OPEN',
    environment: 'QA',
    creatorId: leader.id,
    creator: leader,
    createdAt: daysAgo(1),
    updatedAt: at(30),
    totalItems: primaryRunItems.length,
    passedCount: 1,
    failedCount: 1,
    blockedCount: 1,
    untestedCount: 1,
    milestoneName: 'Sprint 24',
    items: primaryRunItems,
  });

  const secondaryRunItems: MockTestRunItem[] = [
    {
      id: 'run-payments-01-item-1',
      testRunId: 'run-payments-01',
      testCaseId: paymentCases[0].id,
      manualStatus: 'PASS',
      automationStatus: 'PASS',
      finalStatus: 'PASS',
      assigneeId: testerOne.id,
      testCase: {
        id: paymentCases[0].id,
        title: paymentCases[0].title,
        priority: paymentCases[0].priority,
      },
      assignee: {
        firstName: testerOne.firstName,
        lastName: testerOne.lastName,
      },
      caseTitle: paymentCases[0].title,
      casePriority: paymentCases[0].priority,
    },
    {
      id: 'run-payments-01-item-2',
      testRunId: 'run-payments-01',
      testCaseId: authCases[0].id,
      manualStatus: 'PASS',
      automationStatus: 'PASS',
      finalStatus: 'PASS',
      assigneeId: testerTwo.id,
      testCase: {
        id: authCases[0].id,
        title: authCases[0].title,
        priority: authCases[0].priority,
      },
      assignee: {
        firstName: testerTwo.firstName,
        lastName: testerTwo.lastName,
      },
      caseTitle: authCases[0].title,
      casePriority: authCases[0].priority,
    },
    {
      id: 'run-payments-01-item-3',
      testRunId: 'run-payments-01',
      testCaseId: authCases[1].id,
      manualStatus: 'PASS',
      automationStatus: 'PASS',
      finalStatus: 'PASS',
      assigneeId: testerOne.id,
      testCase: {
        id: authCases[1].id,
        title: authCases[1].title,
        priority: authCases[1].priority,
      },
      assignee: {
        firstName: testerOne.firstName,
        lastName: testerOne.lastName,
      },
      caseTitle: authCases[1].title,
      casePriority: authCases[1].priority,
    },
    {
      id: 'run-payments-01-item-4',
      testRunId: 'run-payments-01',
      testCaseId: paymentCases[1].id,
      manualStatus: 'FAIL',
      automationStatus: 'FAIL',
      finalStatus: 'FAIL',
      assigneeId: testerTwo.id,
      testCase: {
        id: paymentCases[1].id,
        title: paymentCases[1].title,
        priority: paymentCases[1].priority,
      },
      assignee: {
        firstName: testerTwo.firstName,
        lastName: testerTwo.lastName,
      },
      caseTitle: paymentCases[1].title,
      casePriority: paymentCases[1].priority,
      errorOutput: 'Ödeme servisi beklenmedik yanıt döndürdü.',
    },
  ];

  const secondaryRun = createRun({
    id: 'run-payments-01',
    title: 'Kritik Ödeme Onay Koşusu',
    project: activeProject,
    status: 'COMPLETED',
    environment: 'DEV',
    creatorId: testerOne.id,
    creator: testerOne,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    totalItems: secondaryRunItems.length,
    passedCount: 3,
    failedCount: 1,
    blockedCount: 0,
    untestedCount: 0,
    milestoneName: 'Ödeme Fokusu',
    items: secondaryRunItems,
  });

  const suitesByProjectId = {
    [activeProject.id]: [authSuite, paymentsSuite],
    [archivedProject.id]: [],
  };

  const casesBySuiteId = {
    [authSuite.id]: authCases,
    [paymentsSuite.id]: paymentCases,
  };

  const milestonesByProjectId = {
    [activeProject.id]: [
      createMilestone({
        id: 'milestone-sprint-24',
        name: 'Sprint 24',
        description: 'Ödeme ve giriş akışlarını stabilize etme hedefi.',
        dueDate: daysFromNow(5),
        status: 'OPEN',
        projectId: activeProject.id,
        createdAt: daysAgo(12),
        updatedAt: daysAgo(1),
        testRuns: [
          {
            id: primaryRun.id,
            title: primaryRun.title,
            status: primaryRun.status,
            environment: primaryRun.environment,
            createdAt: primaryRun.createdAt,
            items: primaryRun.items!.map((item) => ({ finalStatus: item.finalStatus })),
            _count: {
              items: primaryRun.items!.length,
            },
          },
        ],
      }),
      createMilestone({
        id: 'milestone-payments-fokus',
        name: 'Ödeme Fokusu',
        description: 'Ödeme sorunlarını kapatma hedefi.',
        dueDate: daysFromNow(12),
        status: 'COMPLETED',
        projectId: activeProject.id,
        createdAt: daysAgo(18),
        updatedAt: daysAgo(2),
        testRuns: [
          {
            id: secondaryRun.id,
            title: secondaryRun.title,
            status: secondaryRun.status,
            environment: secondaryRun.environment,
            createdAt: secondaryRun.createdAt,
            items: secondaryRun.items!.map((item) => ({ finalStatus: item.finalStatus })),
            _count: {
              items: secondaryRun.items!.length,
            },
          },
        ],
      }),
    ],
    [archivedProject.id]: [],
  };

  const tagsByProjectId = {
    [activeProject.id]: [smokeTag, negativeTag, paymentsTag],
    [archivedProject.id]: [],
  };

  const bugsByProjectId = {
    [activeProject.id]: [
      createBug({
        id: 'bug-checkout-timeout',
        title: 'Ödeme onayı zaman aşımı',
        description: 'Ödeme servisi bazı isteklerde beklenen sürede yanıt vermiyor.',
        stepsToReproduce: '1. Giriş yapın\n2. Ödeme akışını başlatın\n3. Zaman aşımı uyarısını doğrulayın',
        severity: 'CRITICAL',
        projectId: activeProject.id,
        storyId: paymentCases[1].id,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
      }),
      createBug({
        id: 'bug-login-hint',
        title: 'Hatalı parola bildirimi görünmüyor',
        description: 'Geçersiz parola sonrası kullanıcı açık bir hata mesajı görmelidir.',
        stepsToReproduce: '1. Yanlış parola girin\n2. Giriş yapmayı deneyin\n3. Hata mesajını kontrol edin',
        severity: 'HIGH',
        projectId: activeProject.id,
        storyId: authCases[2].id,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      }),
    ],
    [archivedProject.id]: [],
  };

  const projectStats: MockDashboardStats = {
    sprint: {
      id: 'sprint-24',
      name: 'Sprint 24',
      goal: 'Ödeme akışındaki sürtünmeleri azaltmak',
      startDate: daysAgo(14),
      endDate: daysAgo(1),
      totalPoints: 34,
      completedPoints: 28,
      progress: 82,
      daysRemaining: 0,
    },
    stories: {
      total: 18,
      byStatus: {
        TODO: 2,
        IN_PROGRESS: 4,
        DONE: 12,
      },
    },
    bugs: {
      total: 6,
      bySeverity: {
        CRITICAL: 1,
        HIGH: 2,
        MEDIUM: 3,
      },
      byStatus: {
        OPEN: 2,
        IN_PROGRESS: 2,
        FIXED: 2,
      },
    },
    testCases: {
      total: 24,
      byStatus: {
        ACTIVE: 20,
        DRAFT: 4,
      },
    },
    testRuns: {
      total: 6,
      active: 2,
    },
    execution: {
      byStatus: {
        PASS: 80,
        FAIL: 5,
        BLOCK: 2,
        RETEST: 1,
      },
    },
  };

  const management: MockManagementMetrics = {
    timeframe: 'WEEK',
    period: {
      start: daysAgo(7),
      end: daysAgo(0),
    },
    qgi: 87.4,
    passRate: 91.3,
    failRate: 4.1,
    retestRate: 2.2,
    conflictRate: 0.8,
    velocity: 27.5,
    defectTrend: -12.4,
    nextActions: [
      {
        type: 'ALERT',
        metric: 'failRate',
        value: 4.1,
        suggestion: 'Kritik akışta kök neden analizi yapın.',
      },
    ],
  };

  const performance: MockPerformanceRow[] = [
    {
      testerId: testerOne.id,
      name: `${testerOne.firstName} ${testerOne.lastName}`,
      total: 18,
      passRate: 94.4,
      failRate: 2.8,
      retestRate: 2.8,
      blockRate: 0,
      velocity: 14,
      avgDurationMs: 45_200,
    },
    {
      testerId: testerTwo.id,
      name: `${testerTwo.firstName} ${testerTwo.lastName}`,
      total: 14,
      passRate: 85.7,
      failRate: 7.1,
      retestRate: 7.1,
      blockRate: 0,
      velocity: 11,
      avgDurationMs: 53_500,
    },
  ];

  const activities: MockRecentActivity[] = [
    {
      id: 'activity-run-created',
      type: 'RUN_CREATED',
      description: 'Sprint 24 Regresyon koşusu oluşturuldu',
      user: `${leader.firstName} ${leader.lastName}`,
      project: activeProject.name,
      timestamp: at(15),
      meta: { status: 'OPEN' },
    },
    {
      id: 'activity-test-executed',
      type: 'TEST_EXECUTED',
      description: 'Hatalı parola senaryosu yeniden yürütüldü',
      user: `${testerOne.firstName} ${testerOne.lastName}`,
      project: activeProject.name,
      timestamp: at(45),
      meta: { status: 'FAIL' },
    },
    {
      id: 'activity-case-updated',
      type: 'CASE_UPDATED',
      description: 'Ödeme akışı test senaryosu güncellendi',
      user: `${testerTwo.firstName} ${testerTwo.lastName}`,
      project: activeProject.name,
      timestamp: at(90),
      meta: { status: 'PASS' },
    },
  ];

  const primaryReport = createReport(primaryRun);
  const secondaryReport = createReport(secondaryRun);

  const engineeringSpace = createWikiSpace({
    id: 'wiki-space-engineering',
    name: 'Mühendislik',
    description: 'Uygulama akışları, test stratejisi ve çalışma rehberi.',
    projectId: activeProject.id,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(1),
    pages: 2,
  });

  const releaseSpace = createWikiSpace({
    id: 'wiki-space-release',
    name: 'Release',
    description: 'Yayın notları ve son durum özeti.',
    projectId: activeProject.id,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(3),
    pages: 1,
  });

  const wikiRunbookPage = createWikiPage({
    id: 'wiki-page-runbook',
    title: 'Test Çalışma Rehberi',
    content: '# Test Çalışma Rehberi\n\n- Giriş akışı\n- Ödeme akışı\n- Regresyon koşusu',
    spaceId: engineeringSpace.id,
    parentId: 'wiki-page-home',
    author: testerOne,
    version: 1,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1),
  });

  const wikiHomePage = createWikiPage({
    id: 'wiki-page-home',
    title: 'Satış Portalı Wiki',
    content: '<h1>Satış Portalı Wiki</h1><p>Proje kapsamı ve kalite kapıları.</p><ul><li>Giriş</li><li>Ödeme</li></ul>',
    spaceId: engineeringSpace.id,
    author: leader,
    version: 3,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
    children: [wikiRunbookPage],
  });

  const wikiReleasePage = createWikiPage({
    id: 'wiki-page-release-notes',
    title: 'Release Notları',
    content: '# Release Notları\n\n1. Sprint 24 regresyon tamamlandı.\n2. Kritik ödeme hatası incelendi.',
    spaceId: releaseSpace.id,
    author: testerTwo,
    version: 2,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  });

  const releaseCandidate = createReleaseCandidate({
    id: 'release-sprint-24',
    title: 'Sprint 24 Release Candidate',
    summary: 'Sprint 24 sonrası giriş ve ödeme akışlarını yayınlamak için aday.',
    status: 'READY',
    label: '2026.03-rc1',
    readinessScore: 86,
    totalWorkItems: 12,
    completedWorkItems: 10,
    openBugs: 4,
    criticalOpenBugs: 1,
    approvedTestCases: 8,
    totalTestCases: 10,
    openRuns: 2,
    failedRunItems: 1,
    blockedRunItems: 1,
    conflictRunItems: 0,
    traceabilityGaps: 2,
    linkedCommits: 5,
    openPullRequests: 1,
    mergedPullRequests: 3,
    openFollowUpItems: 2,
    completedFollowUpItems: 4,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    decisions: [
      createReleaseDecision({
        id: 'decision-scope',
        type: 'SCOPE',
        outcome: 'APPROVED',
        rationale: 'Kapsam giriş ve ödeme akışlarıyla sınırlandırıldı.',
        confidence: 0.94,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
        author: leader,
      }),
      createReleaseDecision({
        id: 'decision-delivery',
        type: 'DELIVERY',
        outcome: 'CONDITIONAL',
        rationale: 'Bir açık takip öğesi kapanınca yayınlanabilir.',
        confidence: 0.76,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        author: testerOne,
      }),
    ],
    followUps: [
      {
        id: 'follow-up-critical-bug',
        sourceActionType: 'BUG',
        sourceActionFocus: 'critical-bugs',
        createdAt: daysAgo(1),
        createdBy: {
          id: leader.id,
          firstName: leader.firstName,
          lastName: leader.lastName,
        },
        workItem: {
          id: 'bug-checkout-timeout',
          title: 'Ödeme onayı zaman aşımı',
          itemType: 'BUG',
          status: 'OPEN',
          priority: 'CRITICAL',
        },
      },
      {
        id: 'follow-up-traceability',
        sourceActionType: 'TRACEABILITY',
        sourceActionFocus: 'coverage-gaps',
        createdAt: daysAgo(1),
        createdBy: {
          id: testerTwo.id,
          firstName: testerTwo.firstName,
          lastName: testerTwo.lastName,
        },
        workItem: {
          id: 'story-trace-gap',
          title: 'Eksik traceability boşluğunu kapat',
          itemType: 'STORY',
          status: 'TODO',
          priority: 'MEDIUM',
        },
      },
    ],
    runLinks: [
      {
        testRun: {
          id: primaryRun.id,
          title: primaryRun.title,
          status: primaryRun.status,
        },
      },
      {
        testRun: {
          id: secondaryRun.id,
          title: secondaryRun.title,
          status: secondaryRun.status,
        },
      },
    ],
    sourceRequest: {
      id: 'request-checkout-ux',
      title: 'Checkout akışı iyileştirme talebi',
      status: 'APPROVED',
    },
  });

  const releaseAISummary = createReleaseAISummary({
    summary: 'Giriş ve ödeme akışları hazır, fakat bir kritik hata ve bir açık takip öğesi release kararını koşullu hâle getiriyor.',
    recommendation: 'CONDITIONAL',
    confidence: 84,
    topRisks: [
      'Kritik ödeme hatası halen açık.',
      'Bir açık PR henüz birleştirilmedi.',
    ],
    highlights: [
      'Kapsam kararları tamamlandı.',
      'Test kapsamı büyük oranda onaylandı.',
      'İki bağlı test koşusu yayın kanıtı sağlıyor.',
    ],
    nextActions: [
      {
        type: 'BUG',
        priority: 'HIGH',
        title: 'Kritik ödeme hatasını kapat',
        description: 'Ödeme onayı zaman aşımı için takip hatası açın.',
        actionLabel: 'Takip hatası oluştur',
        targetTab: 'backlog',
        targetFocus: 'critical-bugs',
      },
      {
        type: 'RUN',
        priority: 'MEDIUM',
        title: 'Başarısız koşuları yeniden çalıştır',
        description: 'Fail ve block sonuçlarını tekrar yürütün.',
        actionLabel: 'Koşuları aç',
        targetTab: 'runs',
        targetFocus: 'failed-runs',
      },
      {
        type: 'TRACEABILITY',
        priority: 'LOW',
        title: 'Kapsam boşluklarını RTM üzerinden incele',
        description: 'Bağsız story ve senaryoları görünür kılın.',
        actionLabel: 'RTM',
        targetTab: 'traceability',
        targetFocus: 'coverage-gaps',
      },
    ],
  });

  const testCaseAttachments: Record<string, MockAttachmentMeta[]> = {
    [authCases[0].id]: [
      createAttachment({
        id: 'attachment-case-login-1',
        filename: 'login-step.png',
        mimetype: 'image/png',
        size: 124_218,
        url: '/api/v1/storage/attachments/attachment-case-login-1',
        objectKey: 'test-cases/case-login-success/login-step.png',
        category: 'TEST_CASE',
        createdAt: daysAgo(1),
      }),
    ],
    [paymentCases[0].id]: [
      createAttachment({
        id: 'attachment-case-payment-1',
        filename: 'payment-flow.mp4',
        mimetype: 'video/mp4',
        size: 3_024_212,
        url: '/api/v1/storage/attachments/attachment-case-payment-1',
        objectKey: 'test-cases/case-payment-approved/payment-flow.mp4',
        category: 'TEST_CASE',
        createdAt: daysAgo(1),
      }),
    ],
  };

  const wikiPageAttachments: Record<string, MockAttachmentMeta[]> = {
    [wikiHomePage.id]: [
      createAttachment({
        id: 'attachment-wiki-home-1',
        filename: 'architecture.png',
        mimetype: 'image/png',
        size: 88_412,
        url: '/api/v1/storage/attachments/attachment-wiki-home-1',
        objectKey: 'wiki/wiki-page-home/architecture.png',
        category: 'WIKI_PAGE',
        createdAt: daysAgo(2),
      }),
    ],
  };

  const traceability = createTraceabilityResponse();
  const loginNavStep = createAutomationStep({
    id: 'automation-step-login-nav',
    name: 'Giriş sayfasını aç',
    description: 'Kullanıcıyı oturum açma ekranına yönlendirir.',
    locator: '/login',
    actionType: 'NAVIGATE',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 2,
  });
  const loginEmailStep = createAutomationStep({
    id: 'automation-step-login-email',
    name: 'E-posta alanını doldur',
    description: 'Geçerli kullanıcı e-postasını girer.',
    locator: '[data-testid="login-email"]',
    actionType: 'FILL',
    data: 'zeynep.acar@nexa.test',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 2,
  });
  const loginPasswordStep = createAutomationStep({
    id: 'automation-step-login-password',
    name: 'Şifre alanını doldur',
    description: 'Kullanıcı parolasını girer.',
    locator: '[data-testid="login-password"]',
    actionType: 'FILL',
    data: 'Password123!',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 2,
  });
  const loginSubmitStep = createAutomationStep({
    id: 'automation-step-login-submit',
    name: 'Giriş butonuna tıkla',
    description: 'Formu gönderir ve paneli açar.',
    locator: 'button[type="submit"]',
    actionType: 'CLICK',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 2,
  });
  const loginAssertStep = createAutomationStep({
    id: 'automation-step-login-assert',
    name: 'Panel başlığını doğrula',
    description: 'Başarılı giriş sonrası panelin açıldığını doğrular.',
    locator: 'h1:has-text("Panel")',
    actionType: 'ASSERT_VISIBLE',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 1,
  });
  const loginErrorAssertStep = createAutomationStep({
    id: 'automation-step-login-error',
    name: 'Hata mesajını doğrula',
    description: 'Geçersiz parolanın reddedildiğini doğrular.',
    locator: 'text=Geçersiz e-posta veya şifre',
    actionType: 'ASSERT_VISIBLE',
    pageObject: 'LoginPage',
    projectId: activeProject.id,
    scenarioSteps: 1,
  });

  const automationStepsByProjectId = {
    [activeProject.id]: [
      loginNavStep,
      loginEmailStep,
      loginPasswordStep,
      loginSubmitStep,
      loginAssertStep,
      loginErrorAssertStep,
      createAutomationStep({
        id: 'automation-step-payment-check',
        name: 'Ödeme servis yanıtını doğrula',
        description: 'Ödeme akışında API yanıtını inceler.',
        locator: '/payments/check',
        actionType: 'API_REQUEST',
        data: JSON.stringify({ method: 'POST', outputVar: 'PAYMENT_TOKEN' }),
        pageObject: 'PaymentsApi',
        projectId: activeProject.id,
        scenarioSteps: 0,
      }),
    ],
    [archivedProject.id]: [],
  };

  const automationScenariosByTestCaseId = {
    [authCases[0].id]: createAutomationScenario({
      id: 'automation-scenario-login-success',
      testCaseId: authCases[0].id,
      steps: [
        { id: 'automation-scenario-step-1', stepId: loginNavStep.id, step: loginNavStep, orderIndex: 1 },
        { id: 'automation-scenario-step-2', stepId: loginEmailStep.id, step: loginEmailStep, orderIndex: 2 },
        { id: 'automation-scenario-step-3', stepId: loginPasswordStep.id, step: loginPasswordStep, orderIndex: 3 },
        { id: 'automation-scenario-step-4', stepId: loginSubmitStep.id, step: loginSubmitStep, orderIndex: 4 },
        { id: 'automation-scenario-step-5', stepId: loginAssertStep.id, step: loginAssertStep, orderIndex: 5 },
      ],
      variables: {
        BASE_URL: 'http://127.0.0.1:5173',
      },
    }),
    [authCases[2].id]: createAutomationScenario({
      id: 'automation-scenario-login-failed',
      testCaseId: authCases[2].id,
      steps: [
        { id: 'automation-scenario-step-6', stepId: loginNavStep.id, step: loginNavStep, orderIndex: 1 },
        { id: 'automation-scenario-step-7', stepId: loginEmailStep.id, step: loginEmailStep, orderIndex: 2 },
        { id: 'automation-scenario-step-8', stepId: loginPasswordStep.id, step: loginPasswordStep, orderIndex: 3 },
        { id: 'automation-scenario-step-9', stepId: loginSubmitStep.id, step: loginSubmitStep, orderIndex: 4 },
        { id: 'automation-scenario-step-10', stepId: loginErrorAssertStep.id, step: loginErrorAssertStep, orderIndex: 5 },
      ],
      variables: {
        BASE_URL: 'http://127.0.0.1:5173',
      },
    }),
  };

  const authUser = role === 'ADMIN' ? admin : leader;
  const authToken = role === 'ADMIN' ? 'mock-admin-token' : 'mock-team-leader-token';

  const emptyReleaseCandidate = createReleaseCandidate({
    id: 'rc-v2-empty',
    title: 'Sprint 25 Boş Sürüm',
    status: 'DRAFT',
    readinessScore: 0,
    totalWorkItems: 0,
    completedWorkItems: 0,
    openBugs: 0,
    criticalOpenBugs: 0,
    totalTestCases: 5,
    approvedTestCases: 0,
    openRuns: 1,
    failedRunItems: 0,
    blockedRunItems: 0,
    conflictRunItems: 0,
    traceabilityGaps: 5,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  });

  const rcV1Candidate = createReleaseCandidate({
    id: 'rc-v1',
    title: 'Release V1 - Critical Bugs',
    status: 'DRAFT',
    readinessScore: 70,
    totalWorkItems: 10,
    completedWorkItems: 7,
    openBugs: 2,
    criticalOpenBugs: 2,
    approvedTestCases: 8,
    totalTestCases: 10,
    openRuns: 1,
    failedRunItems: 0,
    blockedRunItems: 0,
    conflictRunItems: 0,
    traceabilityGaps: 2,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  });

  const draftTestCase = createTestCase({
    id: 'tc-draft-01',
    title: 'Yeni Taslak Test',
    suite: authSuite,
    author: testerOne,
    priority: 'MEDIUM',
    status: 'DRAFT',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  });

  // Patching suites and cases
  casesBySuiteId[authSuite.id] = [...casesBySuiteId[authSuite.id], draftTestCase];

  return {
    auth: {
      credentials: {
        email: authUser.email,
        password: 'Password123!',
      },
      token: authToken,
      user: authUser,
      projectPermissions: {
        [activeProject.id]: [
          'project.read',
          'project.update',
          'run.read',
          'run.create',
          'test-case:read',
          'test-suite:write',
          'test:write',
          'test:delete',
          'test:approve',
          'test:execute',
          'wiki:write',
        ],
      },
    },
    users: role === 'ADMIN' ? [admin, leader, testerOne, testerTwo] : [leader, testerOne, testerTwo],
    projects: [activeProject, archivedProject],
    suitesByProjectId,
    casesBySuiteId,
    milestonesByProjectId,
    tagsByProjectId,
    bugsByProjectId,
    runs: [primaryRun, secondaryRun],
    reportsByRunId: {
      [primaryRun.id]: primaryReport,
      [secondaryRun.id]: secondaryReport,
    },
    projectStatsById: {
      [activeProject.id]: projectStats,
      [archivedProject.id]: {
        sprint: null,
        stories: { total: 3, byStatus: { TODO: 1, DONE: 2 } },
        bugs: { total: 0, bySeverity: {}, byStatus: {} },
        testCases: { total: 9, byStatus: { ACTIVE: 9 } },
        testRuns: { total: 1, active: 0 },
        execution: { byStatus: { PASS: 6, FAIL: 1, BLOCK: 0, RETEST: 0 } },
      },
    },
    businessRequestsByProjectId: {},
    businessRequestGuidanceById: {},
    integrationsByProjectId: {},
    wikiSpacesByProjectId: {
      [activeProject.id]: [engineeringSpace, releaseSpace],
      [archivedProject.id]: [],
    },
    wikiPagesBySpaceId: {
      [engineeringSpace.id]: [wikiHomePage],
      [releaseSpace.id]: [wikiReleasePage],
    },
    releasesByProjectId: {
      [activeProject.id]: [rcV1Candidate, emptyReleaseCandidate],
      [archivedProject.id]: [],
    },
    releaseAISummariesByCandidateId: {
      ['rc-v1']: releaseAISummary,
    },
    traceabilityByProjectId: {
      [activeProject.id]: traceability,
      [archivedProject.id]: {
        matrix: [],
        stats: {
          totalStories: 0,
          coveredStories: 0,
          coverageRate: 0,
        },
      },
    },
    automationStepsByProjectId,
    automationScenariosByTestCaseId,
    testCaseAttachmentsById: testCaseAttachments,
    wikiPageAttachmentsById: wikiPageAttachments,
    testResultAttachmentsById: {},
    dashboard: {
      management,
      performance,
      activities,
    },
    ai: {
      questions: [
        {
          text: 'Bu projenin birincil kullanıcıları kimlerdir?',
          suggestions: ['İç ekip', 'Müşteriler', 'Destek ekibi'],
        },
        {
          text: 'En kritik başarı ölçütü nedir?',
          suggestions: ['Teslim hızı', 'Hata oranı', 'Kullanım kolaylığı'],
        },
        {
          text: 'Başarısızlık halinde ilk kontrol edilecek alan nedir?',
          suggestions: ['Ödeme servisi', 'Kimlik doğrulama', 'Bildirimler'],
        },
      ],
      architectureQuestions: [
        {
          text: 'Hangi teknoloji yığını kullanılacak?',
          suggestions: ['React + TypeScript', 'Node.js + Express'],
        },
        {
          text: 'Veri katmanı nasıl izole edilecek?',
          suggestions: ['Modüler servisler', 'Tek katmanlı mimari'],
        },
      ],
      documentationSuite: {
        scope: '# Kapsam\n\nSatış portalı için kapsam metni.',
        architecture: '# Mimari\n\nReact tabanlı tek sayfa uygulama ve Node.js backend.',
        testStrategy: '# Test Stratejisi\n\nSmoke, regresyon ve yetki kontrolleri.',
        automationStrategy: '# Otomasyon Stratejisi\n\nPlaywright ile uçtan uca akışlar.',
        releasePolicy: '# Release Politikası\n\nÖnce kalite kapıları, sonra yayın.',
      },
      architecture: '# Mimari\n\nServis odaklı modüler bir yapı.',
    },
    projectWarnings: [],
    notifications: emptyNotificationList(),
  };
}

export function createMockLeaderScenario(): MockScenario {
  return createMockWorkspaceScenario('TEAM_LEADER');
}

export function createMockTesterScenario(): MockScenario {
  return createMockWorkspaceScenario('TESTER');
}

export function createMockAdminScenario(): MockScenario {
  return createMockWorkspaceScenario('ADMIN');
}
