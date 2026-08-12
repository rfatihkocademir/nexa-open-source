import type { Page, Route } from '@playwright/test';
import { URL } from 'node:url';

import {
  createReport,
  createReleaseAISummary,
  createReleaseCandidate,
  createReleaseDecision,
  createRun,
  createTestCase,
  createWikiPage,
} from './mock-data';
import type {
  MockAttachmentMeta,
  MockAutomationActionType,
  MockScenario,
  MockProject,
  MockMilestone,
  MockReleaseCandidate,
  MockReleaseAISummary,
  MockDecisionOutcome,
  MockDecisionType,
  MockTag,
  MockTestCase,
  MockTestSuite,
  MockTestRunItem,
  MockTestRun,
  MockRunReport,
  MockUser,
  MockWikiPage,
  MockWikiSpace,
  MockTraceabilityResponse,
  MockAutomationStep,
  MockAutomationScenario,
  MockBug,
} from './mock-data';

type MockReleaseFollowUp = NonNullable<MockReleaseCandidate['followUps']>[number];

function jsonEnvelope<T>(data: T, message = 'Success') {
  return {
    status: 'success',
    message,
    data,
  };
}

function failEnvelope(message: string, status = 404) {
  return {
    status,
    body: JSON.stringify({
      status: 'error',
      message,
      data: null,
    }),
  };
}

function ok(route: Route, data: unknown, message = 'Success', status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(jsonEnvelope(data, message)),
  });
}

function fail(route: Route, message: string, status = 404) {
  const payload = failEnvelope(message, status);
  return route.fulfill({
    status: payload.status,
    contentType: 'application/json',
    body: payload.body,
  });
}

function safeJson(requestBody: string | null): Record<string, unknown> {
  if (!requestBody) return {};
  try {
    return JSON.parse(requestBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function paginate<T>(items: T[], page: number, limit: number) {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const start = (safePage - 1) * safeLimit;
  const data = items.slice(start, start + safeLimit);

  return {
    data,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    },
  };
}

function updateUser(current: MockUser, patch: Record<string, unknown>): MockUser {
  return {
    ...current,
    firstName: typeof patch.firstName === 'string' ? patch.firstName : current.firstName,
    lastName: typeof patch.lastName === 'string' ? patch.lastName : current.lastName,
    avatarUrl: patch.avatarUrl === null || typeof patch.avatarUrl === 'string' ? patch.avatarUrl as string | null | undefined : current.avatarUrl,
  };
}

function buildProjectFromBody(scenario: MockScenario, body: Record<string, unknown>): MockProject {
  const memberIds = Array.isArray(body.memberIds)
    ? body.memberIds.filter((value): value is string => typeof value === 'string')
    : [];

  const selectedMembers = [scenario.auth.user, ...scenario.users.filter((user) => memberIds.includes(user.id) && user.id !== scenario.auth.user.id)];
  const id = `project-${scenario.projects.length + 1}`;
  const now = new Date().toISOString();

  return {
    id,
    key: typeof body.key === 'string' && body.key.trim()
      ? body.key.trim().toUpperCase()
      : `PRJ${scenario.projects.length + 1}`,
    name: typeof body.name === 'string' ? body.name : `Yeni Proje ${scenario.projects.length + 1}`,
    description: typeof body.description === 'string' ? body.description : '',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    _count: {
      suites: 0,
      testCases: 0,
      testRuns: 0,
      members: selectedMembers.length,
    },
    testRuns: [],
    members: selectedMembers.map((user) => ({
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

function findSuite(suites: MockTestSuite[] | undefined, suiteId: string): MockTestSuite | undefined {
  if (!suites) return undefined;
  for (const suite of suites) {
    if (suite.id === suiteId) return suite;
    const child = findSuite(suite.children, suiteId);
    if (child) return child;
  }
  return undefined;
}

function findProjectSuites(scenario: MockScenario, projectId: string) {
  return scenario.suitesByProjectId[projectId] ?? [];
}

function findProjectMilestones(scenario: MockScenario, projectId: string) {
  return scenario.milestonesByProjectId[projectId] ?? [];
}

function updateProjectCollections(scenario: MockScenario, projectId: string) {
  if (!scenario.suitesByProjectId[projectId]) scenario.suitesByProjectId[projectId] = [];
  if (!scenario.milestonesByProjectId[projectId]) scenario.milestonesByProjectId[projectId] = [];
  if (!scenario.tagsByProjectId[projectId]) scenario.tagsByProjectId[projectId] = [];
}

function findProjectById(scenario: MockScenario, projectId: string) {
  return scenario.projects.find((project) => project.id === projectId);
}

function findUserById(scenario: MockScenario, userId: string) {
  return scenario.users.find((user) => user.id === userId);
}

function findWikiSpaceById(scenario: MockScenario, spaceId: string): MockWikiSpace | undefined {
  return Object.values(scenario.wikiSpacesByProjectId).flat().find((space) => space.id === spaceId);
}

function flattenWikiPages(pages: MockWikiPage[]): MockWikiPage[] {
  const flat: MockWikiPage[] = [];
  for (const page of pages) {
    flat.push(page);
    if (page.children?.length) {
      flat.push(...flattenWikiPages(page.children));
    }
  }
  return flat;
}

function findWikiPageById(scenario: MockScenario, pageId: string): MockWikiPage | undefined {
  return Object.values(scenario.wikiPagesBySpaceId)
    .flatMap((pages) => flattenWikiPages(pages))
    .find((page) => page.id === pageId);
}

function findReleaseCandidateById(scenario: MockScenario, candidateId: string): MockReleaseCandidate | undefined {
  return Object.values(scenario.releasesByProjectId).flat().find((candidate) => candidate.id === candidateId);
}

function findTestCaseById(scenario: MockScenario, caseId: string): MockTestCase | undefined {
  return Object.values(scenario.casesBySuiteId).flat().find((entry) => entry.id === caseId);
}

function findProjectIdByTestCaseId(scenario: MockScenario, caseId: string): string | undefined {
  return findTestCaseById(scenario, caseId)?.suite?.projectId;
}

function findAutomationStepById(scenario: MockScenario, stepId: string): MockAutomationStep | undefined {
  return Object.values(scenario.automationStepsByProjectId)
    .flat()
    .find((step) => step.id === stepId);
}

function findAutomationScenarioById(scenario: MockScenario, scenarioId: string): MockAutomationScenario | undefined {
  return Object.values(scenario.automationScenariosByTestCaseId).find((entry) => entry.id === scenarioId);
}

function findAutomationScenarioForStepId(scenario: MockScenario, scenarioStepId: string) {
  return Object.values(scenario.automationScenariosByTestCaseId).find((entry) =>
    entry.steps.some((step) => step.id === scenarioStepId),
  );
}

function refreshAutomationStepCounts(scenario: MockScenario, projectId: string) {
  const steps = scenario.automationStepsByProjectId[projectId] ?? [];
  const usageByStepId = new Map<string, number>();

  for (const automationScenario of Object.values(scenario.automationScenariosByTestCaseId)) {
    for (const scenarioStep of automationScenario.steps) {
      usageByStepId.set(scenarioStep.stepId, (usageByStepId.get(scenarioStep.stepId) ?? 0) + 1);
    }
  }

  for (const step of steps) {
    step._count = {
      scenarioSteps: usageByStepId.get(step.id) ?? 0,
    };
  }
}

function refreshAutomationScenarios(scenario: MockScenario, projectId: string) {
  refreshAutomationStepCounts(scenario, projectId);
}

function createAutomationScenarioStep(step: MockAutomationStep, orderIndex: number) {
  return {
    id: `automation-scenario-step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    stepId: step.id,
    step,
    orderIndex,
  };
}

type SuggestedAutomationStep = {
  name: string;
  locator: string;
  actionType: MockAutomationActionType;
  description: string;
  confidence: number;
};

function buildSuggestedSteps(html: string): SuggestedAutomationStep[] {
  const source = html.toLowerCase();
  const suggestions: SuggestedAutomationStep[] = [
    {
      name: 'Sayfayı aç',
      locator: '/login',
      actionType: 'NAVIGATE' as const,
      description: 'Kullanıcıyı hedef akışın başlangıcına taşır.',
      confidence: 0.98,
    },
  ];

  if (source.includes('login') || source.includes('giriş')) {
    suggestions.push(
      {
        name: 'E-posta alanını doldur',
        locator: '[data-testid="login-email"]',
        actionType: 'FILL' as const,
        description: 'Geçerli kullanıcı e-postasını girer.',
        confidence: 0.95,
      },
      {
        name: 'Şifre alanını doldur',
        locator: '[data-testid="login-password"]',
        actionType: 'FILL' as const,
        description: 'Geçerli kullanıcı şifresini girer.',
        confidence: 0.94,
      },
      {
        name: 'Giriş butonuna tıkla',
        locator: 'button[type="submit"]',
        actionType: 'CLICK' as const,
        description: 'Formu gönderir.',
        confidence: 0.92,
      },
    );
  } else if (source.includes('payment') || source.includes('ödeme')) {
    suggestions.push(
      {
        name: 'Ödeme formunu aç',
        locator: '[data-testid="payment-form"]',
        actionType: 'ASSERT_VISIBLE' as const,
        description: 'Ödeme formunun görünür olduğunu doğrular.',
        confidence: 0.91,
      },
      {
        name: 'Kart numarasını doldur',
        locator: '[data-testid="card-number"]',
        actionType: 'FILL' as const,
        description: 'Kart numarası alanına değer girer.',
        confidence: 0.88,
      },
      {
        name: 'Ödemeyi onayla',
        locator: 'button[type="submit"]',
        actionType: 'CLICK' as const,
        description: 'Ödeme işlemini gönderir.',
        confidence: 0.9,
      },
    );
  } else if (source.includes('wiki') || source.includes('makale')) {
    suggestions.push(
      {
        name: 'Wiki sayfasını aç',
        locator: '[contenteditable="true"]',
        actionType: 'ASSERT_VISIBLE' as const,
        description: 'Düzenleyicinin görünür olduğunu doğrular.',
        confidence: 0.86,
      },
      {
        name: 'Başlığı güncelle',
        locator: 'input[placeholder="Sayfa Başlığı"]',
        actionType: 'FILL' as const,
        description: 'Sayfa başlığını değiştirir.',
        confidence: 0.84,
      },
    );
  } else {
    suggestions.push(
      {
        name: 'İlk öğeyi doğrula',
        locator: 'main',
        actionType: 'ASSERT_VISIBLE' as const,
        description: 'İlgili ana alanın açıldığını doğrular.',
        confidence: 0.8,
      },
      {
        name: 'Bir etkileşim gerçekleştir',
        locator: 'button',
        actionType: 'CLICK' as const,
        description: 'Kullanıcı etkileşimi tetikler.',
        confidence: 0.78,
      },
    );
  }

  return suggestions;
}

function buildDryRunResult(steps: MockAutomationStep[], variables: Record<string, string>, headless: boolean) {
  const totalDuration = 1_500 + steps.length * 375 + Object.keys(variables).length * 25 + (headless ? 0 : 250);
  const forcedFailure = variables.FORCE_FAIL === 'true' || variables.EXPECT_FAILURE === 'true';
  const failureIndex = steps.findIndex((step) => {
    const haystack = `${step.name} ${step.description ?? ''} ${step.locator} ${step.data ?? ''}`.toLowerCase();
    return /fail|error|missing|bozuk|hata/.test(haystack);
  });
  const hasFailure = forcedFailure || failureIndex >= 0;
  const resolvedFailureIndex = failureIndex >= 0 ? failureIndex : Math.max(steps.length - 1, 0);
  const videoUrl = headless ? undefined : `/api/v1/storage/attachments/automation-video-${Date.now()}`;
  return {
    status: hasFailure ? 'FAIL' as const : 'PASS' as const,
    duration: totalDuration,
    logs: [
      `Çalıştırılan adım sayısı: ${steps.length}`,
      `Değişken sayısı: ${Object.keys(variables).length}`,
      `Başlatma modu: ${headless ? 'headless' : 'headed'}`,
      hasFailure
        ? `Hata: ${steps[resolvedFailureIndex]?.name || 'Bilinmeyen adım'} doğrulanamadı.`
        : 'Çalıştırma başarıyla tamamlandı.',
      ...steps.map((step, index) => `[${index + 1}] ${step.name} -> ${step.actionType}`),
    ].join('\n'),
    steps: steps.map((step, index) => ({
      name: step.name,
      status: hasFailure && index === resolvedFailureIndex ? 'failed' as const : 'passed' as const,
      duration: 250 + index * 25,
      error: hasFailure && index === resolvedFailureIndex ? 'Beklenen doğrulama karşılanmadı.' : undefined,
    })),
    videoUrl,
  };
}

function findAttachmentCollection(
  scenario: MockScenario,
  collection: 'testCaseAttachmentsById' | 'wikiPageAttachmentsById' | 'testResultAttachmentsById',
  entityId: string,
) {
  return scenario[collection][entityId] ?? [];
}

function findAttachmentById(scenario: MockScenario, attachmentId: string): MockAttachmentMeta | undefined {
  const collections: Array<Record<string, MockAttachmentMeta[]>> = [
    scenario.testCaseAttachmentsById,
    scenario.wikiPageAttachmentsById,
    scenario.testResultAttachmentsById,
  ];

  for (const collection of collections) {
    for (const attachments of Object.values(collection)) {
      const match = attachments.find((attachment) => attachment.id === attachmentId);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
}

function readMultipartField(rawBody: string | null, fieldName: string): string | undefined {
  if (!rawBody) return undefined;
  const pattern = new RegExp(`name="${fieldName}"\\r?\\n\\r?\\n([\\s\\S]*?)(?:\\r?\\n--|$)`);
  const match = rawBody.match(pattern);
  return match?.[1]?.trim() || undefined;
}

function inferAttachmentMimeType(filename: string | undefined, fallback = 'image/png') {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.ogg')) return 'video/ogg';
  if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return fallback;
}

function createAttachmentRecord(params: {
  filename?: string;
  mimetype?: string;
  category?: string;
}): MockAttachmentMeta {
  const id = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = params.filename || 'upload.png';
  const mimetype = params.mimetype || inferAttachmentMimeType(filename);
  const category = params.category || 'GENERAL';

  return {
    id,
    filename,
    mimetype,
    size: 1_024,
    url: `/api/v1/storage/attachments/${id}`,
    objectKey: `${category.toLowerCase()}/${id}/${filename}`,
    category,
    createdAt: new Date().toISOString(),
  };
}

function buildRunReport(run: MockTestRun): MockRunReport {
  const passed = run.passedCount;
  const failed = run.failedCount;
  const blocked = run.blockedCount;
  const untested = run.untestedCount;
  const skipped = Math.max(run.totalItems - passed - failed - blocked - untested, 0);

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
    cases: (run.items ?? []).map((item, index) => ({
      id: `${run.id}-case-${index + 1}`,
      title: item.caseTitle || item.testCase.title,
      status:
        item.finalStatus === 'PASS'
          ? 'Passed'
          : item.finalStatus === 'FAIL'
            ? 'Failed'
            : item.finalStatus === 'BLOCK'
              ? 'Blocked'
              : 'Untested',
      duration: item.finalStatus === 'UNTESTED' ? '0 sn' : '12 sn',
      assignee: item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : 'Atanmadı',
      error: item.errorOutput,
    })),
  };
}

function refreshRunReportCache(scenario: MockScenario, run: MockTestRun) {
  scenario.reportsByRunId[run.id] = buildRunReport(run);
}

function emptyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+Jp8AAAAASUVORK5CYII=',
    'base64',
  );
}

function buildUserDetails(scenario: MockScenario, user: MockUser) {
  return {
    ...user,
    members: scenario.projects
      .filter((project) => project.members.some((member) => member.user.id === user.id))
      .map((project) => ({
        projectId: project.id,
        project: {
          id: project.id,
          name: project.name,
        },
      })),
  };
}

function findRunById(scenario: MockScenario, runId: string) {
  return scenario.runs.find((run) => run.id === runId);
}

function buildRunConflicts(run: MockTestRun | undefined) {
  if (!run?.items) return [];
  return run.items
    .filter((item) => item.manualStatus !== item.automationStatus)
    .map((item, index) => ({
      id: `conflict-${item.id}-${index}`,
      testCase: {
        title: item.caseTitle || item.testCase.title,
      },
      manualStatus: item.manualStatus,
      automationStatus: item.automationStatus ?? 'UNTESTED',
      finalStatus: item.finalStatus,
    }));
}

function buildComparisonReport(run: MockTestRun | undefined) {
  const items = run?.items ?? [];
  const conflicts = items.filter((item) => item.manualStatus !== item.automationStatus).length;
  const matched = items.length - conflicts;

  return {
    totalTests: items.length,
    matched,
    conflicts,
    manualOnly: 0,
    automationOnly: 0,
    dualExecution: items.length,
    matchRate: items.length > 0 ? Math.round((matched / items.length) * 100) : 0,
  };
}

function routeMatch(pathname: string, suffix: string) {
  return pathname.startsWith(suffix);
}

export async function installMockApi(page: Page, scenario: MockScenario) {
  await page.route('**/socket.io/**', (route) => route.abort());

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method().toUpperCase();
    const body = safeJson(request.postData());

    if (method === 'POST' && pathname === '/auth/login') {
      const email = typeof body.email === 'string' ? body.email : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (
        email === scenario.auth.credentials.email &&
        password === scenario.auth.credentials.password
      ) {
        return ok(route, {
          user: scenario.auth.user,
          token: scenario.auth.token,
          projectPermissions: scenario.auth.projectPermissions,
        }, 'Login successful');
      }

      return fail(route, 'Invalid email or password', 401);
    }

    if (method === 'POST' && pathname === '/auth/refresh') {
      return ok(route, { token: scenario.auth.token, expiresIn: 900 }, 'Session refreshed');
    }

    if (method === 'POST' && pathname === '/auth/register') {
      return ok(route, {
        user: scenario.auth.user,
        token: scenario.auth.token,
        projectPermissions: scenario.auth.projectPermissions,
      }, 'Registration successful', 201);
    }

    if (method === 'GET' && pathname === '/users/me') {
      return ok(route, scenario.auth.user);
    }

    if (method === 'GET' && pathname === '/dashboard/overview') {
      return ok(route, {
        projects: scenario.projects.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          _count: {
            suites: scenario.suitesByProjectId[project.id]?.length ?? 0,
            testRuns: scenario.runs.filter((run) => run.projectId === project.id).length,
          },
        })),
        totals: {
          projects: scenario.projects.length,
          suites: Object.values(scenario.suitesByProjectId).reduce((total, suites) => total + suites.length, 0),
          testRuns: scenario.runs.length,
          members: scenario.users.length,
        },
      });
    }
    if (method === 'GET' && pathname === '/dashboard/my-work') return ok(route, { workItems: [], testItems: [] });
    if (method === 'GET' && pathname === '/action-center/summary') return ok(route, { total: 0, critical: 0, high: 0, dueSoon: 0 });
    if (method === 'GET' && pathname === '/action-center') return ok(route, { items: [], total: 0 });
    if (method === 'GET' && pathname === '/service-desk/tickets') return ok(route, []);
    if (method === 'GET' && pathname === '/service-desk/analytics') return ok(route, { totalTickets: 0, openTickets: 0, resolvedTickets: 0, breachedCount: 0, slaComplianceRate: 100, csatScore: 0, ratedTicketCount: 0 });
    if (method === 'GET' && pathname === '/service-desk/sla-policies') return ok(route, []);
    if (method === 'GET' && pathname === '/automation-coverage/coverage') return ok(route, { projectId: url.searchParams.get('projectId'), totalTestCases: 24, automatedTestCases: 12, manualTestCases: 12, coveragePercentage: 50, passRate: 96, totalExecutions: 120, hoursSaved: 30, gridBrowsers: [{ name: 'Chromium', passRate: 98 }, { name: 'Firefox', passRate: 95 }, { name: 'WebKit', passRate: 96 }], deviceProfiles: [{ name: 'Desktop HD', type: 'DESKTOP' }, { name: 'iPad Pro', type: 'TABLET' }, { name: 'iPhone 14', type: 'MOBILE' }] });
    if (method === 'GET' && pathname === '/enterprise/operational-policy') return ok(route, { organizationId: 'org-mock', availabilityTargetPct: 99.9, latencyP95TargetMs: 800, errorRateTargetPct: 1, rpoTargetMinutes: 1440, rtoTargetMinutes: 240, backupMaxAgeHours: 26, maintenanceMode: false, maintenanceMessage: null, maintenanceEndsAt: null, updatedAt: null });
    if (method === 'GET' && pathname === '/enterprise/recovery-evidence') return ok(route, []);
    if (method === 'GET' && pathname === '/enterprise/operational-readiness') return ok(route, { status: 'AT_RISK', blockers: ['Güncel başarılı yedek kanıtı yok'], infrastructure: { ready: true, checks: { database: { healthy: true, latencyMs: 4 }, migrations: { healthy: true, latencyMs: 2 }, redis: { healthy: true, latencyMs: 3 }, storage: { healthy: true, latencyMs: 8 } } }, policy: { availabilityTargetPct: 99.9 }, slo: { status: 'NO_DATA', availabilityPct: null, latencyP95Ms: null, errorBudget: { remainingPct: 100, exhausted: false } }, recovery: { lastBackup: null, backupAgeHours: null, backupFresh: false, lastRestoreDrill: null, rpoMet: false, rtoMet: false }, security: { siemDeadLetters: 0, unsignedAuditLogs: 0 } });
    if (method === 'GET' && pathname === '/enterprise/security-incidents') return ok(route, []);
    if (method === 'GET' && pathname === '/enterprise/siem/destinations') return ok(route, []);
    if (method === 'GET' && pathname === '/enterprise/siem/deliveries') return ok(route, []);

    if (method === 'PATCH' && pathname === '/users/me') {
      const updated = updateUser(scenario.auth.user, body);
      scenario.auth.user = updated;
      scenario.users = scenario.users.map((user) => (user.id === updated.id ? updated : user));
      return ok(route, updated, 'Profile updated successfully');
    }

    if (method === 'GET' && pathname === '/users') {
      return ok(route, scenario.users);
    }

    if (method === 'GET' && routeMatch(pathname, '/users/')) {
      const userId = pathname.split('/users/')[1];
      const user = findUserById(scenario, userId);
      if (!user) {
        return fail(route, 'User not found', 404);
      }
      return ok(route, buildUserDetails(scenario, user), 'User retrieved successfully');
    }

    if (method === 'POST' && pathname === '/users') {
      const id = `user-${scenario.users.length + 1}`;
      const created: MockUser = {
        id,
        email: typeof body.email === 'string' ? body.email : `${id}@nexa.test`,
        firstName: typeof body.firstName === 'string' ? body.firstName : 'Yeni',
        lastName: typeof body.lastName === 'string' ? body.lastName : 'Kullanıcı',
        role: typeof body.role === 'string' ? body.role as MockUser['role'] : 'TESTER',
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        avatarUrl: null,
      };
      scenario.users = [...scenario.users, created];
      return ok(route, created, 'User created successfully', 201);
    }

    if (method === 'PATCH' && routeMatch(pathname, '/users/') && pathname !== '/users/me') {
      const userId = pathname.split('/users/')[1];
      const user = findUserById(scenario, userId);
      if (!user) {
        return fail(route, 'User not found', 404);
      }
      const updated: MockUser = {
        ...user,
        email: typeof body.email === 'string' ? body.email : user.email,
        firstName: typeof body.firstName === 'string' ? body.firstName : user.firstName,
        lastName: typeof body.lastName === 'string' ? body.lastName : user.lastName,
        role: typeof body.role === 'string' ? body.role as MockUser['role'] : user.role,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : user.isActive,
        avatarUrl: body.avatarUrl === null || typeof body.avatarUrl === 'string' ? body.avatarUrl as string | null : user.avatarUrl ?? null,
      };
      scenario.users = scenario.users.map((entry) => (entry.id === userId ? updated : entry));
      scenario.auth.user = scenario.auth.user.id === userId ? updated : scenario.auth.user;
      scenario.projects = scenario.projects.map((project) => ({
        ...project,
        members: project.members.map((member) => (
          member.user.id === userId
            ? { user: { ...member.user, ...updated } }
            : member
        )),
      }));
      return ok(route, updated, 'User updated successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/users/')) {
      const userId = pathname.split('/users/')[1];
      const user = findUserById(scenario, userId);
      if (!user) {
        return fail(route, 'User not found', 404);
      }
      scenario.users = scenario.users.filter((entry) => entry.id !== userId);
      scenario.projects = scenario.projects.map((project) => ({
        ...project,
        members: project.members.filter((member) => member.user.id !== userId),
      }));
      return ok(route, {}, 'User deleted successfully');
    }

    if (method === 'POST' && pathname === '/storage/upload') {
      const rawBody = request.postData();
      const filenameMatch = rawBody?.match(/filename="([^"]+)"/);
      const contentTypeMatch = rawBody?.match(/Content-Type:\s*([^\r\n]+)/i);
      const testCaseId = readMultipartField(rawBody, 'testCaseId');
      const wikiPageId = readMultipartField(rawBody, 'wikiPageId');
      const testResultId = readMultipartField(rawBody, 'testResultId');
      const workItemId = readMultipartField(rawBody, 'workItemId');
      const category = readMultipartField(rawBody, 'category') || (
        wikiPageId ? 'WIKI_PAGE'
          : testCaseId ? 'TEST_CASE'
            : testResultId ? 'TEST_RESULT'
              : workItemId ? 'WORK_ITEM'
                : 'GENERAL'
      );
      const attachment = createAttachmentRecord({
        filename: filenameMatch?.[1],
        mimetype: inferAttachmentMimeType(filenameMatch?.[1], contentTypeMatch?.[1] || undefined),
        category,
      });

      if (testCaseId) {
        scenario.testCaseAttachmentsById[testCaseId] = [
          ...(scenario.testCaseAttachmentsById[testCaseId] ?? []),
          attachment,
        ];
      } else if (wikiPageId) {
        scenario.wikiPageAttachmentsById[wikiPageId] = [
          ...(scenario.wikiPageAttachmentsById[wikiPageId] ?? []),
          attachment,
        ];
      } else if (testResultId) {
        scenario.testResultAttachmentsById[testResultId] = [
          ...(scenario.testResultAttachmentsById[testResultId] ?? []),
          attachment,
        ];
      }

      return ok(route, {
        id: attachment.id,
        filename: attachment.filename,
        mimetype: attachment.mimetype,
        size: attachment.size,
        url: attachment.url,
      }, 'File uploaded successfully', 201);
    }

    if (method === 'GET' && pathname.startsWith('/storage/attachments/')) {
      const attachmentId = pathname.split('/storage/attachments/')[1];
      const attachment = findAttachmentById(scenario, attachmentId);
      if (!attachment) {
        if (attachmentId.startsWith('automation-video-')) {
          return route.fulfill({
            status: 200,
            contentType: 'video/webm',
            body: emptyPngBuffer(),
          });
        }
        return fail(route, 'Attachment not found', 404);
      }
      return route.fulfill({
        status: 200,
        contentType: attachment.mimetype || 'image/png',
        body: emptyPngBuffer(),
      });
    }

    if (method === 'GET' && pathname.startsWith('/storage/work-items/')) {
      const workItemId = pathname.split('/storage/work-items/')[1].replace('/attachments', '');
      return ok(route, scenario.testResultAttachmentsById[workItemId] ?? []);
    }

    if (method === 'GET' && pathname.startsWith('/storage/test-results/')) {
      const testResultId = pathname.split('/storage/test-results/')[1].replace('/attachments', '');
      return ok(route, scenario.testResultAttachmentsById[testResultId] ?? []);
    }

    if (method === 'GET' && pathname === '/tags') {
      const projectId = url.searchParams.get('projectId') || '';
      return ok(route, scenario.tagsByProjectId[projectId] ?? []);
    }

    if (method === 'POST' && pathname === '/tags') {
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const projectTags = scenario.tagsByProjectId[projectId] ?? [];
      const created: MockTag = {
        id: `tag-${projectTags.length + 1}`,
        name: typeof body.name === 'string' ? body.name : 'Yeni Etiket',
        color: typeof body.color === 'string' ? body.color : '#64748b',
        projectId,
      };
      scenario.tagsByProjectId[projectId] = [...projectTags, created];
      return ok(route, created, 'Tag created successfully', 201);
    }

    if (method === 'GET' && pathname === '/bugs') {
      const projectId = url.searchParams.get('projectId') || '';
      return ok(route, scenario.bugsByProjectId[projectId] ?? [], 'Bugs retrieved successfully');
    }

    if (method === 'POST' && pathname === '/bugs') {
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const project = findProjectById(scenario, projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      const projectBugs = scenario.bugsByProjectId[projectId] ?? [];
      const created: MockBug = {
        id: `bug-${Date.now()}`,
        title: typeof body.title === 'string' ? body.title : 'Yeni Hata',
        description: typeof body.description === 'string' ? body.description : '',
        stepsToReproduce: typeof body.stepsToReproduce === 'string' ? body.stepsToReproduce : '',
        severity: typeof body.severity === 'string' ? body.severity as MockBug['severity'] : 'MEDIUM',
        projectId,
        storyId: typeof body.storyId === 'string' ? body.storyId : undefined,
        testResultId: typeof body.testResultId === 'string' ? body.testResultId : undefined,
        foundInEnv: typeof body.foundInEnv === 'string' ? body.foundInEnv as MockBug['foundInEnv'] : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      scenario.bugsByProjectId[projectId] = [created, ...projectBugs];
      return ok(route, created, 'Bug created successfully', 201);
    }

    if (method === 'GET' && pathname === '/suites') {
      const projectId = url.searchParams.get('projectId') || '';
      const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
      const suites = findProjectSuites(scenario, projectId);
      const visibleSuites = includeDeleted ? suites : suites.filter((suite) => !suite.deletedAt);
      return ok(route, {
        items: visibleSuites,
        pagination: {
          total: visibleSuites.length,
          page: 1,
          limit: visibleSuites.length || 10,
          totalPages: 1,
        },
      }, 'Suites retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/suites/')) {
      const suiteId = pathname.split('/suites/')[1];
      const suite = Object.values(scenario.suitesByProjectId)
        .map((items) => findSuite(items, suiteId))
        .find((entry): entry is MockTestSuite => !!entry);
      if (!suite) {
        return fail(route, 'Suite not found', 404);
      }
      return ok(route, suite, 'Suite retrieved successfully');
    }

    if (method === 'GET' && pathname === '/cases/search') {
      const projectId = url.searchParams.get('projectId') || '';
      const page = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '20');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const suites = findProjectSuites(scenario, projectId);
      const allCases = suites.flatMap((suite) => scenario.casesBySuiteId[suite.id] ?? []);
      const filtered = allCases.filter((testCase) => {
        if (testCase.deletedAt) return false;
        if (!search) return true;
        return [
          testCase.title,
          testCase.description,
          testCase.preconditions,
          testCase.suite?.name,
        ].some((value) => typeof value === 'string' && value.toLowerCase().includes(search));
      });
      return ok(route, paginate(filtered, page, limit), 'Test cases retrieved successfully');
    }

    if (method === 'GET' && pathname === '/cases') {
      const suiteId = url.searchParams.get('suiteId') || '';
      const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
      const cases = scenario.casesBySuiteId[suiteId] ?? [];
      const visibleCases = includeDeleted ? cases : cases.filter((testCase) => !testCase.deletedAt);
      return ok(route, visibleCases, 'Test cases retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/cases/') && pathname.endsWith('/history')) {
      const caseId = pathname.split('/cases/')[1].replace('/history', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      const previousVersion = Math.max(testCase.version - 1, 1);
      return ok(route, [
        {
          id: `${testCase.id}-v${testCase.version}`,
          version: testCase.version,
          title: testCase.title,
          steps: testCase.steps ?? [],
          preconditions: testCase.preconditions ?? null,
          changedAt: testCase.updatedAt,
          changedBy: testCase.author,
        },
        {
          id: `${testCase.id}-v${previousVersion}`,
          version: previousVersion,
          title: `${testCase.title} (Önceki sürüm)`,
          steps: (testCase.steps ?? []).slice(0, Math.max((testCase.steps?.length ?? 1) - 1, 1)),
          preconditions: testCase.preconditions ?? null,
          changedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
          changedBy: testCase.author,
        },
      ], 'Test case history retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/cases/')) {
      const caseId = pathname.split('/cases/')[1];
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      return ok(route, testCase, 'Test case retrieved successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/cases/') && pathname.endsWith('/approve')) {
      const caseId = pathname.split('/cases/')[1].replace('/approve', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.status = 'APPROVED';
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Test case approved successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/cases/') && pathname.endsWith('/request-revision')) {
      const caseId = pathname.split('/cases/')[1].replace('/request-revision', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.status = 'REVISE';
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Revision requested successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/cases/') && pathname.endsWith('/move')) {
      const caseId = pathname.split('/cases/')[1].replace('/move', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      const targetSuiteId = typeof body.targetSuiteId === 'string' ? body.targetSuiteId : '';
      const targetSuite = Object.values(scenario.suitesByProjectId).flat().find((entry) => entry.id === targetSuiteId);
      if (!targetSuite) {
        return fail(route, 'Suite not found', 404);
      }
      for (const [suiteId, cases] of Object.entries(scenario.casesBySuiteId)) {
        const index = cases.findIndex((entry) => entry.id === caseId);
        if (index >= 0) {
          cases.splice(index, 1);
          scenario.casesBySuiteId[suiteId] = cases;
          break;
        }
      }
      testCase.suiteId = targetSuite.id;
      testCase.suite = {
        name: targetSuite.name,
        projectId: targetSuite.projectId,
      };
      scenario.casesBySuiteId[targetSuite.id] = [
        ...(scenario.casesBySuiteId[targetSuite.id] ?? []),
        testCase,
      ];
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Test case moved successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/cases/')) {
      const caseId = pathname.split('/cases/')[1];
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.title = typeof body.title === 'string' ? body.title : testCase.title;
      testCase.description = typeof body.description === 'string' ? body.description : testCase.description;
      testCase.preconditions = typeof body.preconditions === 'string' ? body.preconditions : testCase.preconditions;
      testCase.priority = typeof body.priority === 'string' ? body.priority as MockTestCase['priority'] : testCase.priority;
      testCase.status = typeof body.status === 'string' ? body.status as MockTestCase['status'] : testCase.status;
      if (Array.isArray(body.steps)) {
        testCase.steps = body.steps as MockTestCase['steps'];
        testCase.hasSteps = (body.steps as unknown[]).length > 0;
      }
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Test case updated successfully');
    }

    if (method === 'POST' && pathname === '/cases') {
      const suiteId = typeof body.suiteId === 'string' ? body.suiteId : '';
      const suite = Object.values(scenario.suitesByProjectId).flat().find((entry) => entry.id === suiteId);
    if (!suite) {
      return fail(route, 'Suite not found', 404);
    }
    const author = scenario.auth.user;
    const steps = Array.isArray(body.steps) ? body.steps as NonNullable<MockTestCase['steps']> : [];
    const created: MockTestCase = createTestCase({
      id: `case-${(scenario.casesBySuiteId[suiteId]?.length ?? 0) + 1}`,
        title: typeof body.title === 'string' ? body.title : 'Yeni Test Senaryosu',
        description: typeof body.description === 'string' ? body.description : '',
        preconditions: typeof body.preconditions === 'string' ? body.preconditions : '',
        suite,
        author,
      priority: typeof body.priority === 'string' ? body.priority as MockTestCase['priority'] : 'MEDIUM',
      status: 'DRAFT',
      hasSteps: steps.length > 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created.steps = steps;
      scenario.casesBySuiteId[suiteId] = [...(scenario.casesBySuiteId[suiteId] ?? []), created];
      return ok(route, created, 'Test case created successfully', 201);
    }

    if (method === 'POST' && pathname === '/cases/bulk/delete') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
      const hardDelete = typeof body.hardDelete === 'boolean' ? body.hardDelete : false;
      for (const [suiteId, cases] of Object.entries(scenario.casesBySuiteId)) {
        scenario.casesBySuiteId[suiteId] = cases
          .map((testCase) => {
            if (!ids.includes(testCase.id)) return testCase;
            return hardDelete
              ? null
              : { ...testCase, deletedAt: new Date().toISOString() };
          })
          .filter((entry): entry is MockTestCase => !!entry);
      }
      return ok(route, {}, 'Test cases deleted successfully');
    }

    if (method === 'POST' && pathname === '/cases/bulk/status') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
      const status = typeof body.status === 'string' ? body.status as MockTestCase['status'] : 'DRAFT';
      for (const cases of Object.values(scenario.casesBySuiteId)) {
        for (const testCase of cases) {
          if (ids.includes(testCase.id)) {
            testCase.status = status;
            testCase.updatedAt = new Date().toISOString();
          }
        }
      }
      return ok(route, {}, 'Test cases status updated successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/cases/') && pathname.endsWith('/restore')) {
      const caseId = pathname.split('/cases/')[1].replace('/restore', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.deletedAt = null;
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Test case restored successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/cases/') && pathname.includes('/revert/')) {
      const [casePath, versionPart] = pathname.split('/revert/');
      const caseId = casePath.split('/cases/')[1];
      const version = Number(versionPart || '1');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.version = Number.isFinite(version) && version > 0 ? version : testCase.version;
      testCase.updatedAt = new Date().toISOString();
      return ok(route, testCase, 'Test case reverted successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/cases/') && !pathname.includes('/tags/')) {
      const caseId = pathname.split('/cases/')[1];
      const hardDelete = url.searchParams.get('hardDelete') === 'true';
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      if (hardDelete) {
        for (const [suiteId, cases] of Object.entries(scenario.casesBySuiteId)) {
          scenario.casesBySuiteId[suiteId] = cases.filter((entry) => entry.id !== caseId);
        }
      } else {
        testCase.deletedAt = new Date().toISOString();
        testCase.updatedAt = new Date().toISOString();
      }
      return ok(route, {}, 'Test case deleted successfully');
    }

    if (method === 'GET' && pathname.startsWith('/storage/test-cases/')) {
      const testCaseId = pathname.split('/storage/test-cases/')[1].replace('/attachments', '');
      return ok(route, findAttachmentCollection(scenario, 'testCaseAttachmentsById', testCaseId));
    }

    if (method === 'POST' && routeMatch(pathname, '/cases/') && pathname.endsWith('/tags')) {
      const caseId = pathname.split('/cases/')[1].replace('/tags', '');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter((tagId): tagId is string => typeof tagId === 'string') : [];
      const projectId = testCase.suite?.projectId || '';
      const tags = scenario.tagsByProjectId[projectId] ?? [];
      const selectedTags = tagIds
        .map((tagId) => tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is MockTag => !!tag);
      testCase.tags = [
        ...(testCase.tags ?? []),
        ...selectedTags.map((tag) => ({ tag })),
      ];
      return ok(route, {}, 'Tags added successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/cases/') && pathname.includes('/tags/')) {
      const [, rest] = pathname.split('/cases/');
      const [caseId, tagId] = rest.split('/tags/');
      const testCase = findTestCaseById(scenario, caseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      testCase.tags = (testCase.tags ?? []).filter((entry) => entry.tag.id !== tagId);
      return ok(route, {}, 'Tag removed successfully');
    }

    if (method === 'GET' && pathname === '/milestones') {
      const projectId = url.searchParams.get('projectId');
      const page = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '10');
      const milestones = projectId && projectId !== 'all'
        ? findProjectMilestones(scenario, projectId)
        : Object.entries(scenario.milestonesByProjectId).flatMap(([milestoneProjectId, projectMilestones]) => {
            const project = findProjectById(scenario, milestoneProjectId);
            return projectMilestones.map((milestone) => ({
              ...milestone,
              project: project ? { name: project.name } : undefined,
            }));
          });
      const visibleMilestones = milestones.slice((page - 1) * limit, (page - 1) * limit + limit);
      return ok(route, {
        data: visibleMilestones,
        meta: {
          total: milestones.length,
          page,
          limit,
          totalPages: Math.max(Math.ceil(milestones.length / Math.max(limit, 1)), 1),
        },
      }, 'Milestones retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/milestones/')) {
      const milestoneId = pathname.split('/milestones/')[1];
      const milestone = Object.values(scenario.milestonesByProjectId)
        .flat()
        .find((entry) => entry.id === milestoneId);
      if (!milestone) {
        return fail(route, 'Milestone not found', 404);
      }
      return ok(route, milestone, 'Milestone retrieved successfully');
    }

    if (method === 'POST' && pathname === '/milestones') {
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const project = findProjectById(scenario, projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      const newMilestone: MockMilestone = {
        id: `milestone-${(scenario.milestonesByProjectId[projectId]?.length ?? 0) + 1}`,
        name: typeof body.name === 'string' ? body.name : 'Yeni Kilometre Taşı',
        description: typeof body.description === 'string' ? body.description : '',
        dueDate: typeof body.dueDate === 'string' ? body.dueDate : undefined,
        status: 'OPEN',
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testRuns: [],
        _count: { testRuns: 0 },
      };
      scenario.milestonesByProjectId[projectId] = [
        ...(scenario.milestonesByProjectId[projectId] ?? []),
        newMilestone,
      ];
      return ok(route, newMilestone, 'Milestone created successfully', 201);
    }

    if (method === 'PATCH' && routeMatch(pathname, '/milestones/')) {
      const milestoneId = pathname.split('/milestones/')[1];
      const milestones = Object.values(scenario.milestonesByProjectId).flat();
      const milestone = milestones.find((entry) => entry.id === milestoneId);
      if (!milestone) {
        return fail(route, 'Milestone not found', 404);
      }
      milestone.name = typeof body.name === 'string' ? body.name : milestone.name;
      milestone.description = typeof body.description === 'string' ? body.description : milestone.description;
      milestone.dueDate = typeof body.dueDate === 'string' ? body.dueDate : milestone.dueDate;
      milestone.status = typeof body.status === 'string' ? body.status as MockMilestone['status'] : milestone.status;
      milestone.updatedAt = new Date().toISOString();
      return ok(route, milestone, 'Milestone updated successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/milestones/')) {
      const milestoneId = pathname.split('/milestones/')[1];
      for (const [projectId, milestones] of Object.entries(scenario.milestonesByProjectId)) {
        const next = milestones.filter((entry) => entry.id !== milestoneId);
        if (next.length !== milestones.length) {
          scenario.milestonesByProjectId[projectId] = next;
          return ok(route, {}, 'Milestone deleted successfully');
        }
      }
      return fail(route, 'Milestone not found', 404);
    }

    if (method === 'PATCH' && routeMatch(pathname, '/projects/') && pathname.endsWith('/archive')) {
      const projectId = pathname.split('/projects/')[1].replace('/archive', '');
      const project = scenario.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      project.status = 'ARCHIVED';
      return ok(route, project, 'Project archived successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/projects/') && pathname.endsWith('/unarchive')) {
      const projectId = pathname.split('/projects/')[1].replace('/unarchive', '');
      const project = scenario.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      project.status = 'ACTIVE';
      return ok(route, project, 'Project unarchived successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/projects/')) {
      const projectId = pathname.split('/projects/')[1];
      const project = scenario.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      project.name = typeof body.name === 'string' ? body.name : project.name;
      project.description = typeof body.description === 'string' ? body.description : project.description;
      project.updatedAt = new Date().toISOString();
      return ok(route, project, 'Project updated successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/projects/') && !pathname.includes('/members/')) {
      const projectId = pathname.split('/projects/')[1];
      scenario.projects = scenario.projects.filter((entry) => entry.id !== projectId);
      delete scenario.projectStatsById[projectId];
      delete scenario.suitesByProjectId[projectId];
      delete scenario.milestonesByProjectId[projectId];
      delete scenario.tagsByProjectId[projectId];
      delete scenario.wikiSpacesByProjectId[projectId];
      delete scenario.releasesByProjectId[projectId];
      delete scenario.traceabilityByProjectId[projectId];
      return ok(route, {}, 'Project deleted successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/projects/') && pathname.endsWith('/members')) {
      const projectId = pathname.split('/projects/')[1].replace('/members', '');
      const project = findProjectById(scenario, projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const email = typeof body.email === 'string' ? body.email : '';
      const user = userId ? findUserById(scenario, userId) : scenario.users.find((entry) => entry.email === email);
      if (!user) {
        return fail(route, 'User not found', 404);
      }
      const alreadyMember = project.members.some((member) => member.user.id === user.id);
      if (!alreadyMember) {
        project.members = [
          ...project.members,
          {
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
            },
          },
        ];
        project._count.members = project.members.length;
      }
      return ok(route, {}, 'Project member added successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/projects/') && pathname.includes('/members/')) {
      const [projectId, memberId] = pathname.split('/projects/')[1].split('/members/');
      const project = findProjectById(scenario, projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      project.members = project.members.filter((member) => member.user.id !== memberId);
      project._count.members = project.members.length;
      return ok(route, {}, 'Project member removed successfully');
    }

    if (method === 'GET' && pathname === '/projects') {
      const status = (url.searchParams.get('status') || 'ACTIVE') as 'ACTIVE' | 'ARCHIVED';
      const page = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '10');
      const filtered = scenario.projects.filter((project) => project.status === status);
      return ok(route, paginate(filtered, page, limit), 'Projects retrieved successfully');
    }

    if (method === 'GET' && pathname === '/projects/available-teams') {
      return ok(route, [{ id: 'team-workspace', name: 'Workspace Ekibi', slug: 'workspace', _count: { members: scenario.users.length, projects: scenario.projects.length } }]);
    }

    if (method === 'GET' && pathname.startsWith('/resources/projects/')) {
      const key = decodeURIComponent(pathname.slice('/resources/projects/'.length));
      const project = scenario.projects.find((entry) => entry.key.toLowerCase() === key.toLowerCase());
      return project ? ok(route, {
        id: project.id,
        key: project.key,
        slug: project.key.toLowerCase(),
        teamSlug: 'workspace',
        canonicalPath: `/workspace/${project.key.toLowerCase()}`,
      }) : fail(route, 'Project not found', 404);
    }

    if (method === 'GET' && /^\/projects\/[^/]+$/.test(pathname)) {
      const identifier = decodeURIComponent(pathname.slice('/projects/'.length));
      const project = scenario.projects.find((entry) =>
        entry.id === identifier || entry.key.toLowerCase() === identifier.toLowerCase());
      return project ? ok(route, project, 'Project retrieved successfully') : fail(route, 'Project not found', 404);
    }

    if (method === 'GET' && pathname === '/projects/warnings') {
      return ok(route, scenario.projectWarnings);
    }

    if (method === 'POST' && pathname === '/projects') {
      const project = buildProjectFromBody(scenario, body);
      scenario.projects = [project, ...scenario.projects];
      updateProjectCollections(scenario, project.id);
      scenario.projectStatsById[project.id] = {
        sprint: null,
        stories: { total: 0, byStatus: {} },
        bugs: { total: 0, bySeverity: {}, byStatus: {} },
        testCases: { total: 0, byStatus: {} },
        testRuns: { total: 0, active: 0 },
        execution: { byStatus: {} },
      };
      return ok(route, project, 'Project created successfully', 201);
    }

    if (method === 'GET' && /^\/projects\/[^/]+$/.test(pathname)) {
      const projectId = pathname.split('/projects/')[1];
      const project = scenario.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      return ok(route, project, 'Project retrieved successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/questions') {
      return ok(route, { questions: scenario.ai.questions }, 'Questions generated successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/documentation-suite') {
      return ok(route, scenario.ai.documentationSuite, 'Documentation suite generated successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/scope') {
      return ok(route, { scope: scenario.ai.documentationSuite.scope }, 'Scope generated successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/architecture-questions') {
      return ok(route, { questions: scenario.ai.architectureQuestions }, 'Architecture questions generated successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/architecture') {
      return ok(route, { architecture: scenario.ai.architecture }, 'Architecture document generated successfully');
    }

    if (method === 'POST' && pathname === '/projects/ai/wiki') {
      return ok(route, { wiki: '# Wiki\n\nMock wiki content' }, 'Wiki generated successfully');
    }

    if (method === 'POST' && pathname === '/ai/generate-steps') {
      const title = typeof body.title === 'string' ? body.title : '';
      const steps = buildSuggestedSteps(title);
      return ok(route, { steps }, 'Steps generated successfully');
    }

    if (method === 'POST' && pathname === '/ai/generate-stories') {
      return ok(route, {
        stories: [
          {
            title: 'Kullanıcı akışı detaylandırılır',
            description: 'Müşteri yolculuğu için detaylı bir story.',
            acceptanceCriteria: ['Kullanıcı akışı netleşir'],
          },
        ],
      }, 'Stories generated successfully');
    }

    if (method === 'POST' && pathname === '/ai/generate-tests-from-story') {
      return ok(route, {
        suiteId: 'suite-ai-generated',
        testCases: [
          {
            id: 'ai-generated-case-1',
            title: 'AI ile oluşturulan test senaryosu',
            description: 'AI tarafından oluşturulan örnek test senaryosu.',
            priority: 'MEDIUM',
            status: 'DRAFT',
          },
        ],
      }, 'Tests generated successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/ai/') && pathname.endsWith('/extract-elements')) {
      return ok(route, [
        {
          name: 'Giriş butonu',
          locator: 'button[type="submit"]',
          type: 'button',
          description: 'Kullanıcıyı girişe götüren ana eylem.',
        },
        {
          name: 'E-posta alanı',
          locator: 'input[type="email"]',
          type: 'input',
          description: 'Kimlik bilgileri için giriş alanı.',
        },
      ], 'Elements extracted successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/ai/test-results/') && pathname.endsWith('/analyze-failure')) {
      return ok(route, {
        title: 'Başarısızlık kök nedeni',
        description: 'Beklenen metin görünmediği için test başarısız oldu.',
        stepsToReproduce: 'Koşuyu yeniden çalıştırın ve hata mesajını doğrulayın.',
        severity: 'HIGH',
        confidence: 0.88,
        reasoning: 'Hata çıktısı beklenen kullanıcı mesajıyla uyuşmuyor.',
      }, 'Failure analyzed successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/ai/') && pathname.endsWith('/chat')) {
      return ok(route, {
        content: 'AI asistanı için mock yanıt.',
        sources: [
          {
            id: 'source-1',
            type: 'WikiPage',
            similarity: 0.94,
            snippet: 'Test çalışma rehberi',
            title: 'Test Çalışma Rehberi',
            href: '/projects/project-sales/wiki?pageId=wiki-page-runbook',
          },
        ],
      }, 'Chat response generated successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/automation/steps')) {
      const projectId = url.searchParams.get('projectId') || '';
      return ok(route, scenario.automationStepsByProjectId[projectId] ?? [], 'Automation steps retrieved successfully');
    }

    if (method === 'POST' && pathname === '/automation/steps') {
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      if (!findProjectById(scenario, projectId)) {
        return fail(route, 'Project not found', 404);
      }
      const steps = scenario.automationStepsByProjectId[projectId] ?? [];
      const createdStep: MockAutomationStep = {
        id: `automation-step-${Date.now()}-${steps.length + 1}`,
        name: typeof body.name === 'string' ? body.name : 'Yeni Adım',
        description: typeof body.description === 'string' ? body.description : '',
        locator: typeof body.locator === 'string' ? body.locator : '',
        actionType: typeof body.actionType === 'string' ? body.actionType as MockAutomationStep['actionType'] : 'CLICK',
        data: typeof body.data === 'string' ? body.data : undefined,
        pageObject: typeof body.pageObject === 'string' ? body.pageObject : undefined,
        projectId,
        _count: {
          scenarioSteps: 0,
        },
      };
      scenario.automationStepsByProjectId[projectId] = [...steps, createdStep];
      refreshAutomationStepCounts(scenario, projectId);
      return ok(route, createdStep, 'Automation step created successfully', 201);
    }

    if (method === 'POST' && pathname === '/automation/steps/suggest') {
      const html = typeof body.html === 'string' ? body.html : '';
      return ok(route, buildSuggestedSteps(html), 'Automation steps suggested successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/automation/steps/')) {
      const stepId = pathname.split('/automation/steps/')[1];
      const step = findAutomationStepById(scenario, stepId);
      if (!step) {
        return fail(route, 'Automation step not found', 404);
      }
      step.name = typeof body.name === 'string' ? body.name : step.name;
      step.description = typeof body.description === 'string' ? body.description : step.description;
      step.locator = typeof body.locator === 'string' ? body.locator : step.locator;
      step.actionType = typeof body.actionType === 'string' ? body.actionType as MockAutomationStep['actionType'] : step.actionType;
      step.data = typeof body.data === 'string' ? body.data : step.data;
      step.pageObject = typeof body.pageObject === 'string' ? body.pageObject : step.pageObject;
      refreshAutomationStepCounts(scenario, step.projectId);
      return ok(route, step, 'Automation step updated successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/automation/steps/')) {
      const stepId = pathname.split('/automation/steps/')[1];
      const step = findAutomationStepById(scenario, stepId);
      if (!step) {
        return fail(route, 'Automation step not found', 404);
      }
      const projectId = step.projectId;
      scenario.automationStepsByProjectId[projectId] = (scenario.automationStepsByProjectId[projectId] ?? []).filter((entry) => entry.id !== stepId);
      for (const automationScenario of Object.values(scenario.automationScenariosByTestCaseId)) {
        automationScenario.steps = automationScenario.steps.filter((entry) => entry.stepId !== stepId);
      }
      refreshAutomationStepCounts(scenario, projectId);
      return ok(route, {}, 'Automation step deleted successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/automation/scenarios/testcase/')) {
      const testCaseId = pathname.split('/automation/scenarios/testcase/')[1];
      const scenarioEntry = scenario.automationScenariosByTestCaseId[testCaseId];
      if (!scenarioEntry) {
        return fail(route, 'Automation scenario not found', 404);
      }
      return ok(route, scenarioEntry, 'Automation scenario retrieved successfully');
    }

    if (method === 'POST' && pathname === '/automation/scenarios') {
      const testCaseId = typeof body.testCaseId === 'string' ? body.testCaseId : '';
      const testCase = findTestCaseById(scenario, testCaseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }
      const projectId = testCase.suite?.projectId || findProjectIdByTestCaseId(scenario, testCaseId) || '';
      const steps = Array.isArray(body.steps)
        ? body.steps
          .map((entry, index) => {
            const stepId = typeof entry?.stepId === 'string' ? entry.stepId : '';
            const step = findAutomationStepById(scenario, stepId);
            if (!step) return null;
            return createAutomationScenarioStep(step, typeof entry?.orderIndex === 'number' ? entry.orderIndex : index + 1);
          })
          .filter((entry): entry is NonNullable<typeof entry> => !!entry)
        : [];
      const createdScenario: MockAutomationScenario = {
        id: `automation-scenario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        testCaseId,
        steps,
        variables: typeof body.variables === 'object' && body.variables !== null ? body.variables as Record<string, string> : {},
        status: 'DRAFT',
        version: 1,
      };
      scenario.automationScenariosByTestCaseId[testCaseId] = createdScenario;
      if (projectId) {
        refreshAutomationScenarios(scenario, projectId);
      }
      return ok(route, createdScenario, 'Automation scenario created successfully', 201);
    }

    if (method === 'POST' && routeMatch(pathname, '/automation/scenarios/') && pathname.endsWith('/publish')) {
      const scenarioId = pathname.split('/automation/scenarios/')[1]?.replace(/\/publish$/, '');
      const scenarioEntry = findAutomationScenarioById(scenario, scenarioId);
      if (!scenarioEntry) {
        return fail(route, 'Automation scenario not found', 404);
      }
      if (!scenarioEntry.steps.length) {
        return fail(route, 'Cannot publish an empty automation scenario', 400);
      }
      const wasPublished = scenarioEntry.status === 'PUBLISHED';
      scenarioEntry.status = 'PUBLISHED';
      scenarioEntry.version = (scenarioEntry.version ?? 1) + (wasPublished ? 1 : 0);
      return ok(route, scenarioEntry, 'Automation scenario published successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/automation/scenarios/')) {
      const scenarioId = pathname.split('/automation/scenarios/')[1];
      const scenarioEntry = findAutomationScenarioById(scenario, scenarioId);
      if (!scenarioEntry) {
        return fail(route, 'Automation scenario not found', 404);
      }
      if (body.variables && typeof body.variables === 'object') {
        scenarioEntry.variables = body.variables as Record<string, string>;
        scenarioEntry.status = 'DRAFT';
      }
      if (Array.isArray(body.steps)) {
        scenarioEntry.steps = body.steps
          .map((entry) => {
            const step = findAutomationStepById(scenario, typeof entry?.stepId === 'string' ? entry.stepId : '');
            if (!step) return null;
            return createAutomationScenarioStep(step, typeof entry?.orderIndex === 'number' ? entry.orderIndex : 1);
          })
          .filter((entry): entry is NonNullable<typeof entry> => !!entry);
      }
      const projectId = findProjectIdByTestCaseId(scenario, scenarioEntry.testCaseId);
      if (projectId) {
        refreshAutomationScenarios(scenario, projectId);
      }
      return ok(route, scenarioEntry, 'Automation scenario updated successfully');
    }

    if (method === 'POST' && pathname === '/automation/scenario-steps') {
      const scenarioId = typeof body.scenarioId === 'string' ? body.scenarioId : '';
      const stepId = typeof body.stepId === 'string' ? body.stepId : '';
      const orderIndex = typeof body.orderIndex === 'number' ? body.orderIndex : 1;
      const scenarioEntry = findAutomationScenarioById(scenario, scenarioId);
      const step = findAutomationStepById(scenario, stepId);
      if (!scenarioEntry || !step) {
        return fail(route, 'Automation scenario step could not be created', 404);
      }
      const createdStep = createAutomationScenarioStep(step, orderIndex);
      scenarioEntry.steps = [...scenarioEntry.steps, createdStep].sort((a, b) => a.orderIndex - b.orderIndex);
      const projectId = findProjectIdByTestCaseId(scenario, scenarioEntry.testCaseId);
      if (projectId) {
        refreshAutomationScenarios(scenario, projectId);
      }
      return ok(route, createdStep, 'Automation scenario step created successfully', 201);
    }

    if (method === 'DELETE' && routeMatch(pathname, '/automation/scenario-steps/')) {
      const scenarioStepId = pathname.split('/automation/scenario-steps/')[1];
      for (const automationScenario of Object.values(scenario.automationScenariosByTestCaseId)) {
        const nextSteps = automationScenario.steps.filter((entry) => entry.id !== scenarioStepId);
        if (nextSteps.length !== automationScenario.steps.length) {
          automationScenario.steps = nextSteps
            .map((entry, index) => ({ ...entry, orderIndex: index + 1 }))
            .sort((a, b) => a.orderIndex - b.orderIndex);
          const projectId = findProjectIdByTestCaseId(scenario, automationScenario.testCaseId);
          if (projectId) {
            refreshAutomationScenarios(scenario, projectId);
          }
          return ok(route, {}, 'Automation scenario step deleted successfully');
        }
      }
      return fail(route, 'Automation scenario step not found', 404);
    }

    if (method === 'PATCH' && pathname === '/automation/scenario-steps/reorder') {
      const scenarioId = typeof body.scenarioId === 'string' ? body.scenarioId : '';
      const scenarioEntry = findAutomationScenarioById(scenario, scenarioId);
      if (!scenarioEntry) {
        return fail(route, 'Automation scenario not found', 404);
      }
      if (Array.isArray(body.steps)) {
        const orderMap = new Map<string, number>(
          body.steps
            .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.orderIndex === 'number')
            .map((entry) => [entry.id as string, entry.orderIndex as number]),
        );
        scenarioEntry.steps = scenarioEntry.steps
          .map((entry) => ({
            ...entry,
            orderIndex: orderMap.get(entry.id) ?? entry.orderIndex,
          }))
          .sort((a, b) => a.orderIndex - b.orderIndex);
      }
      const projectId = findProjectIdByTestCaseId(scenario, scenarioEntry.testCaseId);
      if (projectId) {
        refreshAutomationScenarios(scenario, projectId);
      }
      return ok(route, {}, 'Automation scenario steps reordered successfully');
    }

    if (method === 'POST' && pathname === '/automation/scenarios/dry-run') {
      const steps = Array.isArray(body.steps)
        ? body.steps
          .filter((entry): entry is MockAutomationStep => !!entry && typeof entry.id === 'string')
        : [];
      const variables = typeof body.variables === 'object' && body.variables !== null
        ? body.variables as Record<string, string>
        : {};
      const headless = typeof body.headless === 'boolean' ? body.headless : true;
      return ok(route, buildDryRunResult(steps, variables, headless), 'Automation dry run completed successfully');
    }

    if (method === 'POST' && pathname === '/automation/scenarios/cleanup-video') {
      return ok(route, {}, 'Video cleaned up successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/projects/') && pathname.endsWith('/analytics/traceability')) {
      const projectId = pathname.split('/projects/')[1].replace('/analytics/traceability', '');
      const traceability = scenario.traceabilityByProjectId[projectId];
      if (!traceability) {
        return fail(route, 'Traceability data not found', 404);
      }
      const epicId = url.searchParams.get('epicId');
      if (!epicId || epicId === 'all') {
        return ok(route, traceability, 'Traceability retrieved successfully');
      }
      return ok(route, {
        ...traceability,
        matrix: traceability.matrix.filter((entry) => entry.id === epicId),
      }, 'Traceability retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/projects/') && pathname.endsWith('/wiki/spaces')) {
      const projectId = pathname.split('/projects/')[1].replace('/wiki/spaces', '');
      return ok(route, scenario.wikiSpacesByProjectId[projectId] ?? [], 'Wiki spaces retrieved successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/projects/') && pathname.endsWith('/wiki/spaces')) {
      const projectId = pathname.split('/projects/')[1].replace('/wiki/spaces', '');
      if (!findProjectById(scenario, projectId)) {
        return fail(route, 'Project not found', 404);
      }
      const spaceId = `wiki-space-${Object.keys(scenario.wikiSpacesByProjectId).length + 1}`;
      const createdSpace: MockWikiSpace = {
        id: spaceId,
        name: typeof body.name === 'string' ? body.name : 'Yeni Alan',
        description: typeof body.description === 'string' ? body.description : '',
        icon: typeof body.icon === 'string' ? body.icon : undefined,
        projectId,
        _count: { pages: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      scenario.wikiSpacesByProjectId[projectId] = [
        ...(scenario.wikiSpacesByProjectId[projectId] ?? []),
        createdSpace,
      ];
      scenario.wikiPagesBySpaceId[spaceId] = [];
      return ok(route, createdSpace, 'Wiki space created successfully', 201);
    }

    if (method === 'GET' && routeMatch(pathname, '/wiki/spaces/') && pathname.endsWith('/tree')) {
      const spaceId = pathname.split('/wiki/spaces/')[1].replace('/tree', '');
      return ok(route, scenario.wikiPagesBySpaceId[spaceId] ?? [], 'Wiki tree retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/wiki/pages/')) {
      const pageId = pathname.split('/wiki/pages/')[1];
      const page = findWikiPageById(scenario, pageId);
      if (!page) {
        return fail(route, 'Wiki page not found', 404);
      }
      return ok(route, page, 'Wiki page retrieved successfully');
    }

    if (method === 'POST' && pathname === '/wiki/pages') {
      const spaceId = typeof body.spaceId === 'string' ? body.spaceId : '';
      const space = findWikiSpaceById(scenario, spaceId);
      if (!space) {
        return fail(route, 'Wiki space not found', 404);
      }
      const parentId = typeof body.parentId === 'string' ? body.parentId : undefined;
      const createdPage = createWikiPage({
        id: `wiki-page-${Date.now()}`,
        title: typeof body.title === 'string' ? body.title : 'Başlıksız Sayfa',
        content: body.content ?? '',
        spaceId,
        parentId,
        author: scenario.auth.user,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const rootPages = scenario.wikiPagesBySpaceId[spaceId] ?? [];
      if (parentId) {
        const parentPage = findWikiPageById(scenario, parentId);
        if (parentPage) {
          parentPage.children = [...(parentPage.children ?? []), createdPage];
        } else {
          rootPages.push(createdPage);
        }
      } else {
        rootPages.push(createdPage);
      }
      scenario.wikiPagesBySpaceId[spaceId] = rootPages;
      space._count = { pages: rootPages.length };
      return ok(route, createdPage, 'Wiki page created successfully', 201);
    }

    if (method === 'PUT' && routeMatch(pathname, '/wiki/pages/')) {
      const pageId = pathname.split('/wiki/pages/')[1];
      const page = findWikiPageById(scenario, pageId);
      if (!page) {
        return fail(route, 'Wiki page not found', 404);
      }
      page.title = typeof body.title === 'string' ? body.title : page.title;
      page.content = typeof body.content !== 'undefined' ? body.content : page.content;
      page.updatedAt = new Date().toISOString();
      page.version += 1;
      return ok(route, page, 'Wiki page updated successfully');
    }

    if (method === 'GET' && pathname.startsWith('/storage/wiki-pages/')) {
      const wikiPageId = pathname.split('/storage/wiki-pages/')[1].replace('/attachments', '');
      return ok(route, findAttachmentCollection(scenario, 'wikiPageAttachmentsById', wikiPageId));
    }

    if (method === 'GET' && pathname.startsWith('/storage/test-cases/')) {
      const testCaseId = pathname.split('/storage/test-cases/')[1].replace('/attachments', '');
      return ok(route, findAttachmentCollection(scenario, 'testCaseAttachmentsById', testCaseId));
    }

    if (method === 'DELETE' && pathname.startsWith('/storage/attachments/')) {
      const attachmentId = pathname.split('/storage/attachments/')[1];
      for (const [testCaseId, attachments] of Object.entries(scenario.testCaseAttachmentsById)) {
        const next = attachments.filter((attachment) => attachment.id !== attachmentId);
        if (next.length !== attachments.length) {
          scenario.testCaseAttachmentsById[testCaseId] = next;
          return ok(route, {}, 'Attachment deleted successfully');
        }
      }
      for (const [pageId, attachments] of Object.entries(scenario.wikiPageAttachmentsById)) {
        const next = attachments.filter((attachment) => attachment.id !== attachmentId);
        if (next.length !== attachments.length) {
          scenario.wikiPageAttachmentsById[pageId] = next;
          return ok(route, {}, 'Attachment deleted successfully');
        }
      }
      return fail(route, 'Attachment not found', 404);
    }

    if (method === 'GET' && routeMatch(pathname, '/projects/') && pathname.endsWith('/releases')) {
      const projectId = pathname.split('/projects/')[1].replace('/releases', '');
      return ok(route, scenario.releasesByProjectId[projectId] ?? [], 'Release candidates retrieved successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/projects/') && pathname.endsWith('/releases')) {
      const projectId = pathname.split('/projects/')[1].replace('/releases', '');
      if (!findProjectById(scenario, projectId)) {
        return fail(route, 'Project not found', 404);
      }
      const createdCandidate = createReleaseCandidate({
        id: `release-${Date.now()}`,
        title: typeof body.title === 'string' ? body.title : 'Yeni Release Candidate',
        summary: typeof body.summary === 'string' ? body.summary : '',
        status: 'DRAFT',
        label: typeof body.label === 'string' ? body.label : '',
        readinessScore: 0,
        totalWorkItems: 0,
        completedWorkItems: 0,
        openBugs: 0,
        criticalOpenBugs: 0,
        approvedTestCases: 0,
        totalTestCases: 0,
        openRuns: 0,
        failedRunItems: 0,
        blockedRunItems: 0,
        conflictRunItems: 0,
        traceabilityGaps: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        runLinks: Array.isArray(body.testRunIds)
          ? (body.testRunIds as string[])
            .filter((runId) => typeof runId === 'string')
            .map((runId) => {
              const run = findRunById(scenario, runId);
              return run
                ? {
                    testRun: {
                      id: run.id,
                      title: run.title,
                      status: run.status,
                    },
                  }
                : null;
            })
            .filter((item): item is NonNullable<typeof item> => !!item)
          : [],
        sourceRequest: typeof body.sourceRequestId === 'string'
          ? {
              id: body.sourceRequestId,
              title: typeof body.title === 'string' ? body.title : 'Kaynak Talep',
              status: 'APPROVED',
            }
          : null,
      });
      scenario.releasesByProjectId[projectId] = [
        ...(scenario.releasesByProjectId[projectId] ?? []),
        createdCandidate,
      ];
      scenario.releaseAISummariesByCandidateId[createdCandidate.id] = createReleaseAISummary({
        summary: 'Yeni release adayının AI özeti henüz hazırlanmadı.',
        recommendation: 'NOT_READY',
        confidence: 0,
        topRisks: [],
        highlights: [],
        nextActions: [],
      });
      return ok(route, createdCandidate, 'Release candidate created successfully', 201);
    }

    if (method === 'GET' && routeMatch(pathname, '/projects/') && pathname.includes('/releases/')) {
      const projectId = pathname.split('/projects/')[1].split('/releases/')[0];
      const releaseId = pathname.split('/releases/')[1].replace('/ai-summary', '');
      const candidate = (scenario.releasesByProjectId[projectId] ?? []).find((entry) => entry.id === releaseId);
      if (!candidate) {
        return fail(route, 'Release candidate not found', 404);
      }
      if (pathname.endsWith('/ai-summary')) {
        return ok(route, scenario.releaseAISummariesByCandidateId[releaseId] ?? {
          summary: 'AI özeti bulunamadı.',
          recommendation: 'NOT_READY',
          confidence: 0,
          topRisks: [],
          highlights: [],
          nextActions: [],
        }, 'AI summary retrieved successfully');
      }
      return ok(route, candidate, 'Release candidate retrieved successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/projects/') && pathname.includes('/releases/') && pathname.endsWith('/decisions')) {
      const projectId = pathname.split('/projects/')[1].split('/releases/')[0];
      const releaseId = pathname.split('/releases/')[1].replace('/decisions', '');
      const candidate = (scenario.releasesByProjectId[projectId] ?? []).find((entry) => entry.id === releaseId);
      if (!candidate) {
        return fail(route, 'Release candidate not found', 404);
      }
      const decision = createReleaseDecision({
        id: `decision-${Date.now()}`,
        type: typeof body.type === 'string' ? body.type as MockDecisionType : 'SCOPE',
        outcome: typeof body.outcome === 'string' ? body.outcome as MockDecisionOutcome : 'APPROVED',
        rationale: typeof body.rationale === 'string' ? body.rationale : '',
        confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: scenario.auth.user,
      });
      candidate.decisions = [decision, ...(candidate.decisions ?? [])];
      candidate.updatedAt = new Date().toISOString();
      return ok(route, candidate, 'Release decision recorded successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/projects/') && pathname.includes('/releases/') && pathname.endsWith('/follow-ups')) {
      const projectId = pathname.split('/projects/')[1].split('/releases/')[0];
      const releaseId = pathname.split('/releases/')[1].replace('/follow-ups', '');
      const candidate = (scenario.releasesByProjectId[projectId] ?? []).find((entry) => entry.id === releaseId);
      if (!candidate) {
        return fail(route, 'Release candidate not found', 404);
      }
      const followUp = {
        id: `follow-up-${Date.now()}`,
        sourceActionType: typeof body.sourceActionType === 'string' ? body.sourceActionType as MockReleaseFollowUp['sourceActionType'] : 'BUG',
        sourceActionFocus: typeof body.sourceActionFocus === 'string' ? body.sourceActionFocus as MockReleaseFollowUp['sourceActionFocus'] : 'critical-bugs',
        createdAt: new Date().toISOString(),
        createdBy: {
          id: scenario.auth.user.id,
          firstName: scenario.auth.user.firstName,
          lastName: scenario.auth.user.lastName,
        },
        workItem: {
          id: `work-item-${Date.now()}`,
          title: typeof body.title === 'string' ? body.title : 'Takip öğesi',
          itemType: typeof body.itemType === 'string' ? body.itemType as 'BUG' | 'STORY' | 'TASK' : 'BUG',
          status: 'OPEN',
          priority: typeof body.priority === 'string' ? body.priority as string : null,
        },
      };
      candidate.followUps = [followUp, ...(candidate.followUps ?? [])];
      candidate.openFollowUpItems = (candidate.openFollowUpItems ?? 0) + 1;
      candidate.updatedAt = new Date().toISOString();
      return ok(route, candidate, 'Release follow-up created successfully');
    }

    if (method === 'GET' && pathname === '/dashboard/stats') {
      const projectId = url.searchParams.get('projectId') || '';
      const stats = scenario.projectStatsById[projectId];
      if (!stats) {
        return fail(route, 'Project stats not found', 404);
      }
      return ok(route, stats, 'Stats retrieved successfully');
    }

    if (method === 'GET' && pathname === '/dashboard/management') {
      if (!scenario.dashboard.management) {
        return ok(route, null, 'Management metrics unavailable');
      }
      return ok(route, scenario.dashboard.management, 'Management metrics retrieved successfully');
    }

    if (method === 'GET' && pathname === '/dashboard/performance') {
      return ok(route, scenario.dashboard.performance, 'Performance metrics retrieved successfully');
    }

    if (method === 'GET' && pathname === '/dashboard/recent-activities') {
      return ok(route, scenario.dashboard.activities, 'Recent activities retrieved successfully');
    }

    if (method === 'GET' && pathname === '/notifications') {
      return ok(route, scenario.notifications, 'Notifications retrieved successfully');
    }

    if (method === 'GET' && pathname === '/runs') {
      const projectId = url.searchParams.get('projectId');
      const page = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '10');
      const filtered = projectId
        ? scenario.runs.filter((run) => run.projectId === projectId)
        : scenario.runs;
      return ok(route, paginate(filtered, page, limit), 'Test runs retrieved successfully');
    }

    if (method === 'GET' && pathname === '/runs/quick-run') {
      return fail(route, 'Method not allowed', 405);
    }

    if (method === 'POST' && pathname === '/runs/quick-run') {
      const testCaseId = typeof body.testCaseId === 'string' ? body.testCaseId : '';
      const testCase = findTestCaseById(scenario, testCaseId);
      if (!testCase) {
        return fail(route, 'Test case not found', 404);
      }

      const projectId = testCase.suite?.projectId || findProjectIdByTestCaseId(scenario, testCaseId);
      const project = projectId ? findProjectById(scenario, projectId) : undefined;
      if (!project) {
        return fail(route, 'Project not found', 404);
      }

      const newRunId = `run-quick-${scenario.runs.length + 1}`;
      const now = new Date().toISOString();
      const items: MockTestRunItem[] = [
        {
          id: `${newRunId}-item-1`,
          testRunId: newRunId,
          testCaseId: testCase.id,
          manualStatus: 'UNTESTED',
          finalStatus: 'UNTESTED',
          testCase: {
            id: testCase.id,
            title: testCase.title,
            priority: testCase.priority,
          },
          caseTitle: testCase.title,
          casePriority: testCase.priority,
        },
      ];
      const quickRun = createRun({
        id: newRunId,
        title: `Hızlı Test - ${testCase.title}`,
        project,
        status: 'OPEN',
        environment: 'QA',
        creatorId: scenario.auth.user.id,
        creator: scenario.auth.user,
        createdAt: now,
        updatedAt: now,
        totalItems: items.length,
        passedCount: 0,
        failedCount: 0,
        blockedCount: 0,
        untestedCount: items.length,
        milestoneName: 'Hızlı Koşu',
        items,
      });

      scenario.runs = [quickRun, ...scenario.runs];
      scenario.reportsByRunId[quickRun.id] = createReport(quickRun);
      return ok(route, quickRun, 'Quick run created successfully', 201);
    }

    if (method === 'GET' && routeMatch(pathname, '/runs/') && pathname.endsWith('/report')) {
      const runId = pathname.split('/runs/')[1].replace('/report', '');
      const report = scenario.reportsByRunId[runId];
      if (!report) {
        return fail(route, 'Report not found', 404);
      }
      return ok(route, report, 'Report retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/runs/') && pathname.endsWith('/conflicts')) {
      const runId = pathname.split('/runs/')[1].replace('/conflicts', '');
      const run = findRunById(scenario, runId);
      return ok(route, buildRunConflicts(run), 'Run conflicts retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/runs/') && pathname.endsWith('/comparison-report')) {
      const runId = pathname.split('/runs/')[1].replace('/comparison-report', '');
      const run = findRunById(scenario, runId);
      return ok(route, buildComparisonReport(run), 'Comparison report retrieved successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/runs/')) {
      const runId = pathname.split('/runs/')[1];
      const run = scenario.runs.find((entry) => entry.id === runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      return ok(route, run, 'Test run retrieved successfully');
    }

    if (method === 'POST' && pathname.startsWith('/items/') && pathname.endsWith('/results')) {
      const itemId = pathname.split('/items/')[1].replace('/results', '');
      for (const run of scenario.runs) {
        const item = run.items?.find((entry) => entry.id === itemId);
        if (!item) continue;

        const status = typeof body.status === 'string' ? body.status as MockTestRunItem['finalStatus'] : 'UNTESTED';
        const now = new Date().toISOString();
        item.manualStatus = status;
        item.finalStatus = status;
        item.results = [
          {
            id: `result-${itemId}-${run.items?.length ?? 0}`,
            runItemId: itemId,
            status,
            duration: typeof body.duration === 'number' ? body.duration : 0,
            comment: typeof body.comment === 'string' ? body.comment : '',
            evidenceUrl: typeof body.evidenceUrl === 'string' ? body.evidenceUrl : undefined,
            testerId: scenario.auth.user.id,
            createdAt: now,
            stepResults: Array.isArray(body.stepResults)
              ? (body.stepResults as Array<{ stepIndex: number; status: MockTestRunItem['finalStatus'] }>)
                .map((entry) => ({
                  stepIndex: entry.stepIndex,
                  status: entry.status,
                }))
              : undefined,
          },
          ...(item.results ?? []),
        ];
        if (status !== 'UNTESTED') {
          run.passedCount = run.items?.filter((entry) => entry.finalStatus === 'PASS').length ?? run.passedCount;
          run.failedCount = run.items?.filter((entry) => entry.finalStatus === 'FAIL').length ?? run.failedCount;
          run.blockedCount = run.items?.filter((entry) => entry.finalStatus === 'BLOCK').length ?? run.blockedCount;
          run.untestedCount = run.items?.filter((entry) => entry.finalStatus === 'UNTESTED').length ?? run.untestedCount;
        } else {
          run.passedCount = run.items?.filter((entry) => entry.finalStatus === 'PASS').length ?? run.passedCount;
          run.failedCount = run.items?.filter((entry) => entry.finalStatus === 'FAIL').length ?? run.failedCount;
          run.blockedCount = run.items?.filter((entry) => entry.finalStatus === 'BLOCK').length ?? run.blockedCount;
          run.untestedCount = run.items?.filter((entry) => entry.finalStatus === 'UNTESTED').length ?? run.untestedCount;
        }
        run.updatedAt = now;
        refreshRunReportCache(scenario, run);
        return ok(route, item.results[0], 'Result added successfully', 201);
      }
      return fail(route, 'Run item not found', 404);
    }

    if (method === 'PATCH' && pathname.startsWith('/items/') && pathname.endsWith('/automation-result')) {
      const itemId = pathname.split('/items/')[1].replace('/automation-result', '');
      for (const run of scenario.runs) {
        const item = run.items?.find((entry) => entry.id === itemId);
        if (!item) continue;
        const status = typeof body.status === 'string' ? body.status as MockTestRunItem['finalStatus'] : item.finalStatus;
        item.automationStatus = status;
        item.finalStatus = status;
        item.results = [
          {
            id: `automation-result-${itemId}`,
            runItemId: itemId,
            status,
            duration: typeof body.duration === 'number' ? body.duration : 0,
            comment: '',
            evidenceUrl: typeof body.videoUrl === 'string' ? body.videoUrl : undefined,
            testerId: scenario.auth.user.id,
            createdAt: new Date().toISOString(),
            stepResults: [],
          },
          ...(item.results ?? []),
        ];
        run.passedCount = run.items?.filter((entry) => entry.finalStatus === 'PASS').length ?? run.passedCount;
        run.failedCount = run.items?.filter((entry) => entry.finalStatus === 'FAIL').length ?? run.failedCount;
        run.blockedCount = run.items?.filter((entry) => entry.finalStatus === 'BLOCK').length ?? run.blockedCount;
        run.untestedCount = run.items?.filter((entry) => entry.finalStatus === 'UNTESTED').length ?? run.untestedCount;
        run.updatedAt = new Date().toISOString();
        refreshRunReportCache(scenario, run);
        return ok(route, item.results[0], 'Automation result updated successfully');
      }
      return fail(route, 'Run item not found', 404);
    }

    if (method === 'POST' && routeMatch(pathname, '/runs/') && pathname.endsWith('/execute-automation')) {
      const runId = pathname.split('/runs/')[1].replace('/execute-automation', '');
      const run = findRunById(scenario, runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      return ok(route, {}, 'Automation execution started successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/runs/items/') && pathname.endsWith('/trigger')) {
      const itemId = pathname.split('/runs/items/')[1].replace('/trigger', '');
      const run = scenario.runs.find((entry) => entry.items?.some((item) => item.id === itemId));
      if (!run) {
        return fail(route, 'Run item not found', 404);
      }
      const item = run.items?.find((entry) => entry.id === itemId)!;
      item.automationStatus = item.automationStatus || 'PASS';
      return ok(route, {}, 'Item automation triggered successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/runs/') && pathname.endsWith('/notify-completion')) {
      const runId = pathname.split('/runs/')[1].replace('/notify-completion', '');
      const run = findRunById(scenario, runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      return ok(route, {}, 'Completion notification sent successfully');
    }

    if (method === 'POST' && routeMatch(pathname, '/runs/') && pathname.endsWith('/items')) {
      const runId = pathname.split('/runs/')[1].replace('/items', '');
      const run = findRunById(scenario, runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      const testCaseIds = Array.isArray(body.testCaseIds)
        ? body.testCaseIds.filter((id): id is string => typeof id === 'string')
        : [];
      const nextItems: MockTestRunItem[] = testCaseIds
        .map((testCaseId, index) => {
          const testCase = findTestCaseById(scenario, testCaseId);
          if (!testCase) return null;
          const nextItem: MockTestRunItem = {
            id: `run-${runId}-item-${run.items?.length ?? 0}-${index + 1}`,
            testRunId: runId,
            testCaseId: testCase.id,
            manualStatus: 'UNTESTED' as const,
            finalStatus: 'UNTESTED' as const,
            assigneeId: undefined,
            testCase: {
              id: testCase.id,
              title: testCase.title,
              priority: testCase.priority,
            },
            caseTitle: testCase.title,
            casePriority: testCase.priority,
          };
          return nextItem;
        })
        .filter((item): item is MockTestRunItem => !!item);
      const currentItems = run.items ?? [];
      run.items = [...currentItems, ...nextItems];
      run.totalItems = run.items.length;
      run.untestedCount = run.items.filter((entry) => entry.finalStatus === 'UNTESTED').length;
      run.updatedAt = new Date().toISOString();
      refreshRunReportCache(scenario, run);
      return ok(route, {}, 'Run items added successfully');
    }

    if (method === 'POST' && pathname === '/runs') {
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const project = findProjectById(scenario, projectId);
      if (!project) {
        return fail(route, 'Project not found', 404);
      }
      const testCaseIds = Array.isArray(body.testCaseIds)
        ? body.testCaseIds.filter((id): id is string => typeof id === 'string')
        : [];
      const newRunId = `run-${scenario.runs.length + 1}`;
      const items: MockTestRunItem[] = testCaseIds
        .map((testCaseId, index) => {
          const testCase = findTestCaseById(scenario, testCaseId);
          if (!testCase) return null;
          return {
            id: `${newRunId}-item-${index + 1}`,
            testRunId: newRunId,
            testCaseId: testCase.id,
            manualStatus: 'UNTESTED',
            finalStatus: 'UNTESTED',
            testCase: {
              id: testCase.id,
              title: testCase.title,
              priority: testCase.priority,
            },
            caseTitle: testCase.title,
            casePriority: testCase.priority,
          } as MockTestRunItem;
        })
        .filter((item): item is MockTestRunItem => !!item);
      const newRun = createRun({
        id: newRunId,
        title: typeof body.title === 'string' ? body.title : 'Yeni Test Koşusu',
        project,
        status: 'OPEN',
        environment: typeof body.environment === 'string' ? body.environment as MockTestRun['environment'] : 'QA',
        creatorId: scenario.auth.user.id,
        creator: scenario.auth.user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalItems: items.length,
        passedCount: 0,
        failedCount: 0,
        blockedCount: 0,
        untestedCount: items.length,
        milestoneName: typeof body.milestoneId === 'string' ? body.milestoneId : 'Global',
        items,
      });
      scenario.runs = [newRun, ...scenario.runs];
      scenario.reportsByRunId[newRun.id] = createReport(newRun);
      return ok(route, newRun, 'Test run created successfully', 201);
    }

    if (method === 'POST' && routeMatch(pathname, '/runs/')) {
      return ok(route, {}, 'Operation completed successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/runs/items/') && pathname.endsWith('/assign')) {
      const itemId = pathname.split('/runs/items/')[1].replace('/assign', '');
      const run = scenario.runs.find((entry) => entry.items?.some((item) => item.id === itemId));
      if (!run) {
        return fail(route, 'Run item not found', 404);
      }
      const item = run.items!.find((entry) => entry.id === itemId)!;
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const user = findUserById(scenario, userId);
      if (!user) {
        return fail(route, 'User not found', 404);
      }
      item.assigneeId = user.id;
      item.assignee = {
        firstName: user.firstName,
        lastName: user.lastName,
      };
      run.updatedAt = new Date().toISOString();
      refreshRunReportCache(scenario, run);
      return ok(route, {}, 'Run item assigned successfully');
    }

    if (method === 'PATCH' && routeMatch(pathname, '/runs/')) {
      const runId = pathname.split('/runs/')[1];
      const run = findRunById(scenario, runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      run.title = typeof body.title === 'string' ? body.title : run.title;
      run.status = typeof body.status === 'string' ? body.status as MockTestRun['status'] : run.status;
      run.environment = typeof body.environment === 'string' ? body.environment as MockTestRun['environment'] : run.environment;
      run.updatedAt = new Date().toISOString();
      refreshRunReportCache(scenario, run);
      return ok(route, run, 'Test run updated successfully');
    }

    if (method === 'DELETE' && routeMatch(pathname, '/runs/items/')) {
      const itemId = pathname.split('/runs/items/')[1];
      for (const run of scenario.runs) {
        const nextItems = run.items?.filter((entry) => entry.id !== itemId);
        if (!nextItems || nextItems.length === run.items?.length) continue;
        run.items = nextItems;
        run.totalItems = nextItems.length;
        run.passedCount = nextItems.filter((entry) => entry.finalStatus === 'PASS').length;
        run.failedCount = nextItems.filter((entry) => entry.finalStatus === 'FAIL').length;
        run.blockedCount = nextItems.filter((entry) => entry.finalStatus === 'BLOCK').length;
        run.untestedCount = nextItems.filter((entry) => entry.finalStatus === 'UNTESTED').length;
        run.updatedAt = new Date().toISOString();
        refreshRunReportCache(scenario, run);
        return ok(route, {}, 'Run item deleted successfully');
      }
      return fail(route, 'Run item not found', 404);
    }

    if (method === 'DELETE' && routeMatch(pathname, '/runs/')) {
      const runId = pathname.split('/runs/')[1];
      const run = findRunById(scenario, runId);
      if (!run) {
        return fail(route, 'Test run not found', 404);
      }
      scenario.runs = scenario.runs.filter((entry) => entry.id !== runId);
      delete scenario.reportsByRunId[runId];
      return ok(route, {}, 'Test run deleted successfully');
    }

    if (method === 'GET' && routeMatch(pathname, '/reports/')) {
      const reportId = pathname.split('/reports/')[1];
      const report = scenario.reportsByRunId[reportId];
      if (!report) {
        return fail(route, 'Report not found', 404);
      }
      return ok(route, report, 'Report retrieved successfully');
    }

    return fail(route, `Unhandled mock endpoint: ${method} ${pathname}`, 501);
  });
}
