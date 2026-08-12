const { test, expect } = require('@playwright/test');

test.describe('Platform health', () => {
  test('liveness endpoint is available without authentication', async ({ request }) => {
    const response = await request.get('/health/live');
    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe('UP');
  });

  test('legacy test endpoint is available', async ({ request }) => {
    const response = await request.get('/test');
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  test('readiness endpoint returns an intentional health result', async ({ request }) => {
    const response = await request.get('/health/ready');
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toBeTruthy();
    expect(typeof body.ready === 'boolean' || typeof body.status === 'string').toBeTruthy();
  });
});
