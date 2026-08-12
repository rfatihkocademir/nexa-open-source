require('dotenv/config');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: Number(process.env.API_TEST_TIMEOUT_MS || 60000),
  expect: { timeout: Number(process.env.API_EXPECT_TIMEOUT_MS || 10000) },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.API_BASE_URL || 'http://127.0.0.1:1996',
    extraHTTPHeaders: {
      accept: 'application/json',
      'x-api-automation': 'nexa-api-automation',
    },
    ignoreHTTPSErrors: process.env.API_IGNORE_HTTPS_ERRORS === 'true',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results',
});
