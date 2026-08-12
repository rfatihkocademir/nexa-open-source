import { defineConfig, devices } from '@playwright/test';

const appUrl = process.env.UI_AUTOMATION_APP_URL || 'http://127.0.0.1:5173';
const backendUrl = process.env.UI_AUTOMATION_BACKEND_URL || 'http://127.0.0.1:1996';

export default defineConfig({
  testDir: './tests/specs',
  timeout: 45 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: './playwright-report/results.json' }],
    ['html', { outputFolder: './playwright-report/html', open: 'never' }],
  ],
  outputDir: './test-results',
  use: {
    baseURL: appUrl,
    locale: 'tr',
    timezoneId: 'Europe/Istanbul',
    actionTimeout: 7_000,
    navigationTimeout: 20_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-chromium',
      grep: /@responsive/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
      },
    },
    {
      name: 'tablet-chromium',
      grep: /@responsive/,
      use: {
        ...devices['iPad Mini'],
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npm --prefix ../frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: appUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_BACKEND_URL: backendUrl,
    },
  },
});
