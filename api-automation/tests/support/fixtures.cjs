const { test: base } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function findToken(value) {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['accessToken', 'token', 'jwt']) {
    if (typeof value[key] === 'string' && value[key].length > 20) return value[key];
  }
  for (const child of Object.values(value)) {
    const token = findToken(child);
    if (token) return token;
  }
  return undefined;
}

function tokenIsUsable(token) {
  if (typeof token !== 'string' || token.length < 20) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now() + 30_000;
  } catch {
    return true;
  }
}

function cachePath(baseURL, email, organizationSlug) {
  if (process.env.API_AUTH_CACHE_FILE) return process.env.API_AUTH_CACHE_FILE;
  const key = crypto.createHash('sha256')
    .update(`${baseURL}|${email}|${organizationSlug || ''}`)
    .digest('hex')
    .slice(0, 24);
  return path.join(os.tmpdir(), `nexa-api-auth-${key}.json`);
}

function readCachedToken(file) {
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    return tokenIsUsable(cached.token) ? cached.token : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedToken(file, token) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ token, cachedAt: new Date().toISOString() }), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

async function waitFor(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loginWithSharedCache({ playwright, baseURL, headers, email, password, organizationSlug }) {
  const file = cachePath(baseURL, email, organizationSlug);
  const lock = `${file}.lock`;

  for (let attempt = 0; attempt < 600; attempt += 1) {
    const cached = readCachedToken(file);
    if (cached) return cached;

    let lockHandle;
    try {
      lockHandle = fs.openSync(lock, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 60_000) fs.unlinkSync(lock);
      } catch {
        // Another worker may have released the lock between stat and unlink.
      }
      await waitFor(100);
      continue;
    }

    try {
      const tokenAfterLock = readCachedToken(file);
      if (tokenAfterLock) return tokenAfterLock;

      const loginContext = await playwright.request.newContext({ baseURL, extraHTTPHeaders: headers });
      try {
        const response = await loginContext.post('/api/v1/auth/login', {
          data: { email, password, ...(organizationSlug ? { organizationSlug } : {}) },
        });
        if (!response.ok()) {
          throw new Error(`API login failed (${response.status()}). Seed a user or set API_AUTH_TOKEN. Response: ${await response.text()}`);
        }
        const token = findToken(await response.json());
        if (!token) throw new Error('API login succeeded but no access token was found in the response.');
        writeCachedToken(file, token);
        return token;
      } finally {
        await loginContext.dispose();
      }
    } finally {
      try { fs.closeSync(lockHandle); } catch { /* lock was not opened */ }
      try { fs.unlinkSync(lock); } catch { /* another worker already removed it */ }
    }
  }

  throw new Error('Timed out while waiting for the shared API authentication session.');
}

const test = base.extend({
  api: [async ({ playwright }, use) => {
    const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:1996';
    const headers = { accept: 'application/json', 'x-api-automation': 'nexa-api-automation' };
    let token = process.env.API_AUTH_TOKEN;

    if (!token) {
      const email = process.env.API_EMAIL;
      const password = process.env.API_PASSWORD;
      if (!email || !password) {
        throw new Error('API_EMAIL and API_PASSWORD (or API_AUTH_TOKEN) must be provided through a secret store.');
      }
      token = await loginWithSharedCache({
        playwright,
        baseURL,
        headers,
        email,
        password,
        organizationSlug: process.env.API_ORGANIZATION_SLUG,
      });
    }

    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { ...headers, authorization: `Bearer ${token}` },
    });
    await use(api);
    await api.dispose();
  }, { scope: 'worker' }],
});

module.exports = { test, expect: require('@playwright/test').expect };
