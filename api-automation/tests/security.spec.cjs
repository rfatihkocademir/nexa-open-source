const { test, expect } = require('./support/fixtures');

test.describe('Authentication, validation and boundary security', () => {
  test('protected resources reject requests without a bearer token', async ({ request }) => {
    const response = await request.get('/api/v1/projects');
    expect([401, 403]).toContain(response.status());
  });

  test('invalid resource identifiers are handled as client errors', async ({ api }) => {
    const response = await api.get('/api/v1/projects/not-a-uuid');
    expect([400, 404]).toContain(response.status());
  });

  test('malformed JSON does not become an internal server error', async ({ api }) => {
    const response = await api.fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: '{"name":',
    });
    expect(response.status()).toBeLessThan(500);
  });

  test('security headers are present', async ({ request }) => {
    const response = await request.get('/health/live');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBeTruthy();
  });
});
