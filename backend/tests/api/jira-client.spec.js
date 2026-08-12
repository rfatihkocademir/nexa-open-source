const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { JiraClientService } = require(path.join(__dirname, '../../dist/services/jira-client.service.js'));

test.describe('secure Jira Cloud client', () => {
  test('tests credentials without exposing the API token', async () => {
    const requests = [];
    const client = new JiraClientService(
      async (url, init) => {
        requests.push({ url, init });
        return new Response(JSON.stringify({ accountId: 'acct-1', displayName: 'Jira Admin', emailAddress: 'admin@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      async () => [{ address: '104.192.142.1' }],
    );
    await expect(client.test({ url: 'https://example.atlassian.net', email: 'admin@example.com', apiToken: 'super-secret' })).resolves.toMatchObject({ connected: true, displayName: 'Jira Admin' });
    expect(requests[0].url).toBe('https://example.atlassian.net/rest/api/3/myself');
    expect(requests[0].init.headers.Authorization).toBe(`Basic ${Buffer.from('admin@example.com:super-secret').toString('base64')}`);
    expect(JSON.stringify(await client.test({ url: 'https://example.atlassian.net', email: 'admin@example.com', apiToken: 'super-secret' }))).not.toContain('super-secret');
  });

  test('uses token pagination and enforces the configured import cap', async () => {
    const bodies = [];
    const client = new JiraClientService(
      async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body);
        const secondPage = body.nextPageToken === 'page-2';
        return new Response(JSON.stringify(secondPage
          ? { issues: [{ id: '2', key: 'PROJ-2', fields: { summary: 'Second' } }], isLast: true }
          : { issues: [{ id: '1', key: 'PROJ-1', fields: { summary: 'First' } }], nextPageToken: 'page-2', isLast: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      async () => [{ address: '104.192.142.1' }],
    );
    const result = await client.fetchIssues({ url: 'https://example.atlassian.net', email: 'admin@example.com', apiToken: 'token', projectKey: 'PROJ' }, { maxIssues: 2 });
    expect(result.issues).toHaveLength(2);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].jql).toContain('project = "PROJ"');
    expect(bodies[1].nextPageToken).toBe('page-2');
  });

  test('rejects unsafe Jira URLs before any outbound request', async () => {
    let requested = false;
    const client = new JiraClientService(async () => {
      requested = true;
      return new Response('{}', { status: 200 });
    }, async () => [{ address: '127.0.0.1' }]);
    await expect(client.test({ url: 'https://example.atlassian.net', email: 'a@example.com', apiToken: 'token' })).rejects.toThrow('Özel ağ');
    await expect(client.test({ url: 'https://attacker.example.com', email: 'a@example.com', apiToken: 'token' })).rejects.toThrow('izin verilen');
    expect(requested).toBe(false);
  });

  test('downloads attachment content without redirects and enforces the size cap', async () => {
    const calls = [];
    const client = new JiraClientService(async (url, init) => {
      calls.push({ url, init });
      return new Response(Buffer.from('attachment'), { status: 200, headers: { 'content-type': 'text/plain' } });
    }, async () => [{ address: '104.192.142.1' }]);
    const config = { url: 'https://example.atlassian.net', email: 'admin@example.com', apiToken: 'token' };
    const file = await client.downloadAttachment(config, { id: '123', filename: 'note.txt', size: 10 });
    expect(file).toMatchObject({ filename: 'note.txt', mimetype: 'text/plain', size: 10 });
    expect(calls[0].url).toContain('/attachment/content/123?redirect=false');
    expect(calls[0].init.redirect).toBe('error');
    await expect(client.downloadAttachment(config, { id: '124', filename: 'huge.bin', size: 30 * 1024 * 1024 })).rejects.toThrow(/25 MB/);
    expect(calls).toHaveLength(1);
  });
});
