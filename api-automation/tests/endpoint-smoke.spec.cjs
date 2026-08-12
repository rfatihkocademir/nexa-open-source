const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('./support/fixtures');
const { pathWithParams, baseQuery, bodyFor, newState } = require('./support/test-data.cjs');

const catalogFile = path.join(__dirname, '..', 'route-catalog.json');
if (!fs.existsSync(catalogFile)) throw new Error('route-catalog.json is missing. Run npm run routes first.');
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const state = newState();

const unsupportedInGenericSmoke = new Set([
  'GET /api/v1/health',
  'GET /api/v1/health/ready',
  'GET /api/v1/health/live',
  'GET /api/v1/test',
  'GET /api/v1/monitor/stream',
  'GET /api/v1/auth/oidc/:providerId/start',
  'GET /api/v1/auth/oidc/:providerId/callback',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/logout-all',
]);

function operationId(operation) {
  return `${operation.method} ${operation.route}`;
}

// Each generated operation uses an isolated placeholder request. Running them
// independently ensures one endpoint failure never hides the remaining catalog.
test.describe.configure({ mode: 'parallel' });
test.describe(`All endpoint contract smoke checks (${catalog.count} operations)`, () => {
  test('route catalog is non-empty, unique and source-backed', async () => {
    expect(catalog.count).toBeGreaterThan(250);
    expect(catalog.operations).toHaveLength(catalog.count);
    expect(new Set(catalog.operations.map(operationId)).size).toBe(catalog.count);
    expect(catalog.operations.every((operation) => operation.source)).toBeTruthy();
  });

  for (const operation of catalog.operations) {
    if (unsupportedInGenericSmoke.has(operationId(operation))) continue;
    test(`${operation.method} ${operation.route} [${operation.source}:${operation.line}]`, async ({ api }) => {
      const path = pathWithParams(operation.route, state);
      const query = baseQuery(operation.route, state);
      const url = query ? `${path}?${query}` : path;
      const body = bodyFor(operation, state);
      const isLongRunningAiOperation = operation.route.startsWith('/api/v1/projects/ai/');
      const response = await api.fetch(url, {
        method: operation.method,
        ...(body === undefined ? {} : { data: body }),
        timeout: Number(process.env.API_ENDPOINT_TIMEOUT_MS || (isLongRunningAiOperation ? 60000 : 15000)),
        maxRedirects: 0,
      });
      const status = response.status();
      const allowedClientStatuses = [200, 201, 202, 204, 301, 302, 303, 307, 308, 400, 401, 403, 404, 409, 415, 422, 429];
      expect(allowedClientStatuses, `${operationId(operation)} returned unexpected status`).toContain(status);
      expect(status, `${operationId(operation)} returned a server error`).toBeLessThan(500);
    });
  }
});
