import { expect, test } from '@playwright/test';

import { loginAs } from '../support/workspace';

test.describe('@responsive kritik responsive akışlar', () => {
  test('login ekranı yatay taşma üretmez', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible');
    await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();
  });

  test('proje listesi viewport dışına taşmaz', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/projects');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
