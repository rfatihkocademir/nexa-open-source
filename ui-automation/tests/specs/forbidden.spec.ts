import { expect, test } from '@playwright/test';

import { loginAs } from '../support/workspace';

test.describe('Yetki reddi', () => {
  test('yetkisiz kullanıcı yönetim alanına girince 403 sayfası görür', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/admin/users');

    await expect(page).toHaveURL(/\/403$/);
    await expect(page.getByRole('heading', { name: '403 Erişim Engellendi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ana Sayfaya Dön' })).toBeVisible();
  });
});
