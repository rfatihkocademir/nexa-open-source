const { test, expect } = require('./support/fixtures');
const { dataOf, firstId, requestJson, expectNoServerError } = require('./support/api.cjs');

test.describe.serial('SDLC API end-to-end business flow', () => {
  const state = {};
  const created = { project: false };

  async function call(api, method, url, body, expected = [200, 201, 204]) {
    const result = await requestJson(api, method, url, body);
    await expectNoServerError(result.response, `${method} ${url}`);
    expect(expected, `${method} ${url} status`).toContain(result.response.status());
    return result;
  }

  test.afterAll(async ({ api }) => {
    // Cleanup is deliberately best-effort so an assertion failure keeps the original evidence.
    for (const [kind, url] of [
      ['run', state.testRunId && `/api/v1/runs/${state.testRunId}`],
      ['case', state.testCaseId && `/api/v1/cases/${state.testCaseId}`],
      ['suite', state.suiteId && `/api/v1/suites/${state.suiteId}`],
      ['workItem', state.workItemId && `/api/v1/work-items/${state.workItemId}`],
      ['project', state.projectId && `/api/v1/projects/${state.projectId}`],
    ]) {
      if (!url || (kind === 'project' && !created.project)) continue;
      try { await api.delete(url); } catch (_) { /* best effort */ }
    }
  });

  test('creates or selects a project as the flow root', async ({ api }) => {
    if (process.env.API_PROJECT_ID) {
      state.projectId = process.env.API_PROJECT_ID;
      created.project = false;
      const result = await call(api, 'GET', `/api/v1/projects/${state.projectId}`);
      expect(firstId(dataOf(result.payload))).toBeTruthy();
      return;
    }

    const result = await call(api, 'POST', '/api/v1/projects', {
      name: `API E2E ${Date.now()}`,
      description: 'Created by Nexa root API automation',
    }, [201]);
    state.projectId = result.id || firstId(result.data);
    created.project = true;
    expect(state.projectId).toBeTruthy();
  });

  test('updates and reads the project contract', async ({ api }) => {
    expect(state.projectId).toBeTruthy();
    await call(api, 'PATCH', `/api/v1/projects/${state.projectId}`, { description: 'Updated through a chained API flow' });
    const result = await call(api, 'GET', `/api/v1/projects/${state.projectId}`);
    expect(result.payload).toBeTruthy();
  });

  test('creates a test suite and a test case', async ({ api }) => {
    const suite = await call(api, 'POST', '/api/v1/suites', {
      projectId: state.projectId,
      name: `Checkout suite ${Date.now()}`,
    }, [201]);
    state.suiteId = suite.id || firstId(suite.data);
    expect(state.suiteId).toBeTruthy();

    const testCase = await call(api, 'POST', '/api/v1/cases', {
      projectId: state.projectId,
      suiteId: state.suiteId,
      title: `Successful checkout ${Date.now()}`,
      description: 'Happy path API test case',
      steps: [{ action: 'Submit checkout', expected: 'Order is created' }],
      priority: 'HIGH',
    }, [201]);
    state.testCaseId = testCase.id || firstId(testCase.data);
    expect(state.testCaseId).toBeTruthy();
  });

  test('updates, approves and reads test-case history', async ({ api }) => {
    await call(api, 'PATCH', `/api/v1/cases/${state.testCaseId}`, { description: 'Updated in E2E lifecycle' });
    await call(api, 'GET', `/api/v1/cases/${state.testCaseId}`);
    await call(api, 'GET', `/api/v1/cases/${state.testCaseId}/history`);
    await call(api, 'PATCH', `/api/v1/cases/${state.testCaseId}/approve`, undefined, [200, 400, 403, 409]);
  });

  test('creates a run, attaches the case and records a result', async ({ api }) => {
    const run = await call(api, 'POST', '/api/v1/runs', {
      projectId: state.projectId,
      title: `Checkout regression ${Date.now()}`,
      environment: 'QA',
      testCaseIds: [state.testCaseId],
    }, [201]);
    state.testRunId = run.id || firstId(run.data);
    expect(state.testRunId).toBeTruthy();

    await call(api, 'GET', `/api/v1/runs/${state.testRunId}`);
    const runItemId = run.data?.items?.[0]?.id || run.data?.testRunItems?.[0]?.id || run.data?.items?.[0]?.runItemId;
    if (runItemId) {
      state.runItemId = runItemId;
      await call(api, 'POST', `/api/v1/items/${runItemId}/results`, { status: 'PASS', duration: 120, comment: 'E2E passed' }, [201]);
      await call(api, 'PATCH', `/api/v1/items/${runItemId}/manual-result`, { status: 'PASS', duration: 120 }, [200, 201]);
    } else {
      await call(api, 'POST', `/api/v1/runs/${state.testRunId}/items`, { testCaseIds: [state.testCaseId] }, [200]);
    }
    await call(api, 'GET', `/api/v1/runs/${state.testRunId}/report`);
  });

  test('creates a backlog item and verifies project-scoped listing', async ({ api }) => {
    const requirement = await call(api, 'POST', '/api/v1/requirements', {
      projectId: state.projectId,
      title: `API E2E requirement ${Date.now()}`,
      description: 'Requirement created as the traceability root of the backlog flow',
      type: 'FUNCTIONAL',
    }, [201]);
    state.requirementId = requirement.id || firstId(requirement.data);
    expect(state.requirementId).toBeTruthy();
    await call(api, 'PATCH', `/api/v1/requirements/${state.requirementId}/status`, {
      nextStatus: 'APPROVED',
      reason: 'Approved as the traceability root for the E2E backlog item',
    });

    const item = await call(api, 'POST', '/api/v1/work-items', {
      projectId: state.projectId,
      requirementId: state.requirementId,
      itemType: 'TASK',
      title: `API E2E task ${Date.now()}`,
      description: 'Backlog item created by the same business flow',
      priority: 'MEDIUM',
    }, [201]);
    state.workItemId = item.id || firstId(item.data);
    expect(state.workItemId).toBeTruthy();
    await call(api, 'GET', `/api/v1/work-items/${state.workItemId}`);
    await call(api, 'PATCH', `/api/v1/work-items/${state.workItemId}`, { title: 'Updated API E2E task' });
    const list = await call(api, 'GET', `/api/v1/work-items?projectId=${state.projectId}`);
    expect(list.payload).toBeTruthy();
  });
});
