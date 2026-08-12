import { expect, test } from '@playwright/test';

import { loginAs } from '../support/workspace';

test.describe('Profil', () => {
  test('profil bilgileri güncellenebilir ve ekranda kalıcı görünür', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Profil Ayarları' })).toBeVisible();
    await page.getByLabel('Ad', { exact: true }).fill('Ada');
    await page.getByLabel('Soyad', { exact: true }).fill('Yılmaz');
    await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();

    await expect(page.getByRole('heading', { name: 'Ada Yılmaz' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ada Yılmaz' })).toBeVisible();
  });
});
