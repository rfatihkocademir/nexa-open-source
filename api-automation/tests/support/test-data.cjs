const { randomUUID } = require('node:crypto');

const UUID = '00000000-0000-0000-0000-000000000001';

function idForParam(name, state) {
  const aliases = {
    projectId: state.projectId,
    id: state.resourceId,
    suiteId: state.suiteId,
    testCaseId: state.testCaseId,
    testRunId: state.testRunId,
    runItemId: state.runItemId,
    itemId: state.runItemId,
    workItemId: state.workItemId,
    sprintId: state.sprintId,
    milestoneId: state.milestoneId,
    userId: state.userId,
    tagId: state.tagId,
    spaceId: state.spaceId,
    pageId: state.pageId,
    wikiPageId: state.pageId,
    wikiSpaceId: state.spaceId,
    initiativeId: state.initiativeId,
    revisionId: state.revisionId,
    roundId: state.roundId,
    exceptionId: state.exceptionId,
    holidayId: state.holidayId,
    dependencyId: state.dependencyId,
    sessionId: state.sessionId,
    elementId: state.elementId,
    dryRunId: state.dryRunId,
  };
  return aliases[name] || UUID;
}

function pathWithParams(route, state) {
  return route.replace(/:([A-Za-z0-9_]+)/g, (_, name) => encodeURIComponent(idForParam(name, state)));
}

function baseQuery(route, state) {
  const query = new URLSearchParams();
  if (route.includes('projectId') || /\/(projects|suites|cases|runs|milestones|requirements|tags|sprints|worklogs|work-items|epics|stories|tasks|bugs)/.test(route)) {
    if (state.projectId) query.set('projectId', state.projectId);
  }
  if (route.includes('/cases') && state.suiteId) query.set('suiteId', state.suiteId);
  return query.toString();
}

function bodyFor(operation, state) {
  const { method, route } = operation;
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(method)) return undefined;
  const projectId = state.projectId || UUID;
  const name = `API automation ${Date.now()}`;
  if (route === '/api/v1/projects' && method === 'POST') return { name, description: 'Created by root API automation' };
  if (route.endsWith('/suites') && method === 'POST') return { name, projectId };
  if (route.endsWith('/cases') && method === 'POST') return { title: `${name} case`, projectId, suiteId: state.suiteId, steps: [{ action: 'Open endpoint', expected: 'Endpoint responds' }] };
  if (route.endsWith('/runs') && method === 'POST') return { title: `${name} run`, projectId, includeAllCases: true, environment: 'QA' };
  if (route.endsWith('/quick-run')) return { testCaseId: state.testCaseId };
  if (route.includes('/results') || route.includes('/manual-result') || route.includes('/automation-result')) return { status: 'PASS', duration: 10, comment: 'Root API automation result' };
  if (route.includes('/work-items') || /\/(epics|stories|tasks|bugs)$/.test(route)) return { projectId, itemType: 'TASK', title: name, description: 'API automation work item', priority: 'MEDIUM' };
  if (route.includes('/milestones')) return { projectId, name, description: 'API automation milestone' };
  if (route.includes('/tags')) return { projectId, name: `tag-${Date.now()}`, color: '#2563eb' };
  if (route.includes('/comments')) return { workItemId: state.workItemId, content: 'API automation comment' };
  if (route.includes('/requirements')) return { projectId, title: `${name} requirement`, description: 'API automation requirement' };
  if (route.includes('/wiki/spaces')) return { name };
  if (route.includes('/wiki/pages')) return { spaceId: state.spaceId || UUID, title: name, content: 'API automation wiki page' };
  if (route.includes('/automation/steps')) return { projectId, name, actionType: 'NAVIGATE', data: 'https://example.com', locator: 'https://example.com' };
  if (route.includes('/automation/scenarios')) return { projectId, testCaseId: state.testCaseId || UUID, steps: [] };
  if (route.includes('/ai/')) return { projectId, title: 'API automation analysis', description: 'Test description', html: '<button>Continue</button>' };
  if (route.includes('/api-automation/parse-curl')) return { curl: 'curl https://example.com/health' };
  if (route.includes('/api-automation/generate-ai-api')) return { prompt: 'GET health endpoint and assert 200' };
  if (route.includes('/api-automation/execute-step')) return { projectId, url: `${process.env.API_BASE_URL || 'http://127.0.0.1:1996'}/health/live`, method: 'GET' };
  if (route.includes('/auth/login')) return { email: process.env.API_EMAIL || 'api-automation@example.invalid', password: process.env.API_PASSWORD || 'provided-by-secret-store' };
  if (route.includes('/auth/forgot-password')) return { email: process.env.API_EMAIL || 'api-automation@example.invalid' };
  if (route.includes('/auth/logout')) return {};
  if (route.includes('/service-desk/tickets')) return { projectId, title: name, description: 'API automation ticket', priority: 'MEDIUM' };
  if (route.includes('/business-requests')) return { projectId, title: name, description: 'API automation business request' };
  if (route.includes('/enterprise/oidc-providers')) return { name, issuer: 'https://idp.example.com', clientId: 'nexa-api-automation', clientSecret: 'nexa-api-automation-secret', scopes: 'openid email profile', allowedDomains: ['example.com'] };
  if (route === '/api/v1/projects/ai/documentation-suite') return { name, description: 'API automation documentation suite', qaPairs: [], language: 'en' };
  if (route === '/api/v1/prompts') return { slug: `api-automation-${Date.now()}`, name, description: 'API automation prompt template' };
  if (route === '/api/v1/users') return { email: `api-automation-${Date.now()}@example.com`, password: 'ApiAutomationPassword123!', firstName: 'API', lastName: 'Automation', role: 'TESTER' };
  if (route.includes('/releases')) return { title: name, summary: 'API automation release', type: 'RELEASE' };
  if (route.includes('/sprints')) return { projectId, name, goal: 'API automation flow' };
  return { projectId, name, title: name, description: 'API automation payload' };
}

function newState() {
  return { marker: randomUUID(), resourceId: UUID, projectId: process.env.API_PROJECT_ID || undefined };
}

module.exports = { UUID, pathWithParams, baseQuery, bodyFor, newState };
