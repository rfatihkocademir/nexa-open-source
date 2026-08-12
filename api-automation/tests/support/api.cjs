const { expect } = require('@playwright/test');

function dataOf(body) {
  return body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

function firstId(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstId(value[0]);
  if (typeof value === 'object') {
    for (const key of ['id', 'projectId', 'suiteId', 'testCaseId', 'testRunId', 'runItemId', 'itemId']) {
      if (value[key]) return value[key];
    }
    for (const nested of Object.values(value)) {
      const id = firstId(nested);
      if (id) return id;
    }
  }
  return undefined;
}

async function jsonOrText(response) {
  const type = response.headers()['content-type'] || '';
  return type.includes('json') ? response.json() : response.text();
}

async function expectNoServerError(response, label) {
  const status = response.status();
  const allow503 = process.env.ALLOW_DEPENDENCY_503 === 'true';
  expect(status, `${label} returned ${status}`).toBeLessThan(500);
  if (!allow503) expect(status, `${label} dependency unavailable`).not.toBe(503);
}

async function requestJson(request, method, url, body) {
  const options = body === undefined ? {} : { data: body };
  const response = await request.fetch(url, { method, ...options });
  const payload = await jsonOrText(response);
  return { response, payload, data: dataOf(payload), id: firstId(dataOf(payload)) };
}

module.exports = { dataOf, firstId, jsonOrText, expectNoServerError, requestJson };
