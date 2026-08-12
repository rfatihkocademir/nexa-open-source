const { test, expect } = require('@playwright/test');
const { XrayClientService } = require('../../dist/services/xray-client.service');

test.describe('secure Xray Cloud client', () => {
  test('authenticates and tests GraphQL without exposing credentials', async () => {
    const calls = [];
    const client = new XrayClientService(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/authenticate')) return new Response(JSON.stringify('x'.repeat(40)), { status: 200 });
      return new Response(JSON.stringify({ data: { getTestExecutions: { total: 0 } } }), { status: 200 });
    });
    await expect(client.test({ xrayClientId: 'client', xrayClientSecret: 'secret' })).resolves.toEqual({ connected: true });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://xray.cloud.getxray.app/api/v2/authenticate');
    expect(calls[1].url).toBe('https://xray.cloud.getxray.app/api/v2/graphql');
    expect(calls[1].init.headers.Authorization).not.toContain('secret');
  });

  test('paginates executions and their test runs', async () => {
    const client = new XrayClientService(async (url, init) => {
      if (url.endsWith('/authenticate')) return new Response(JSON.stringify('x'.repeat(40)), { status: 200 });
      const body = JSON.parse(init.body);
      if (body.query.includes('getTestExecutions')) {
        return new Response(JSON.stringify({ data: { getTestExecutions: { total: 1, results: [{ issueId: '100' }] } } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { getTestRuns: { total: 1, results: [{
        id: 'run-1', status: { name: 'PASSED' }, test: { issueId: '200' }, testExecution: { issueId: '100' }, steps: [],
      }] } } }), { status: 200 });
    });
    const result = await client.fetchExecutions({ xrayClientId: 'client', xrayClientSecret: 'secret' });
    expect(result.executions).toEqual([{ issueId: '100' }]);
    expect(result.runs[0].test.issueId).toBe('200');
  });

  test('rejects incomplete credentials before network access', async () => {
    let called = false;
    const client = new XrayClientService(async () => { called = true; return new Response(); });
    await expect(client.test({ xrayClientId: '', xrayClientSecret: '' })).rejects.toThrow(/zorunludur/);
    expect(called).toBe(false);
  });
});
