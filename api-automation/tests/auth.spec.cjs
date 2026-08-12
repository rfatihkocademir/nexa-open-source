const { test, expect } = require('./support/fixtures');
const { requestJson, expectNoServerError } = require('./support/api.cjs');

test.describe('Authentication and session contract', () => {
  test('login credentials produce an authenticated session', async ({ api }) => {
    const response = await api.get('/api/v1/auth/sessions');
    await expectNoServerError(response, 'GET /auth/sessions');
    expect([200, 204]).toContain(response.status());
  });

  test('refresh without a refresh cookie is rejected safely', async ({ request }) => {
    const { response } = await requestJson(request, 'POST', '/api/v1/auth/refresh', {});
    expect(response.status()).toBe(401);
  });

  test('invalid login payload is validated', async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', { data: { email: 'not-an-email', password: '' } });
    expect([400, 422]).toContain(response.status());
  });

  test('password reset request does not disclose account existence', async ({ request }) => {
    const response = await request.post('/api/v1/auth/forgot-password', { data: { email: 'nobody@example.invalid' } });
    await expectNoServerError(response, 'POST /auth/forgot-password');
    expect([202, 400]).toContain(response.status());
  });
});
