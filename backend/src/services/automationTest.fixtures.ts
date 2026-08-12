import type { Browser, LaunchOptions } from 'playwright';
import { test as base, expect, request } from '@playwright/test';

/**
 * Generated automation specs use this fixture so the same test code can run
 * against local Chromium or the on-prem Browserless CDP endpoint. Browserless
 * root/chromium endpoints speak CDP; the native Playwright endpoint is not
 * used because the self-hosted image can negotiate a different Playwright
 * protocol version than the application dependency.
 */
export const test = base.extend<{}, { browser: Browser }>({
    browser: [async ({ playwright, launchOptions }, use) => {
        const endpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
        const useRemoteBrowser = Boolean(endpoint);
        let browser: Browser;

        if (useRemoteBrowser) {
            browser = await playwright.chromium.connectOverCDP(endpoint!);
        } else {
            browser = await playwright.chromium.launch(launchOptions as LaunchOptions);
        }

        try {
            await use(browser);
        } finally {
            await browser.close();
        }
    }, { scope: 'worker' }],
});

export { expect, request };
