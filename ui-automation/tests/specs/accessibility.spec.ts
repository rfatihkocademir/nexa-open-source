import { expect, test } from '@playwright/test';

import { loginAs } from '../support/workspace';

test.describe('Erişilebilirlik', () => {
  test('giriş ekranı etiketler ve buton isimleriyle erişilebilir olur', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('E-posta')).toBeVisible();
    await expect(page.getByLabel('Şifre')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();
  });

  test('ana gezinme semantik linklerle çalışır', async ({ page }) => {
    await loginAs(page, 'TESTER');

    await page.getByRole('button', { name: 'Gezinme' }).click();
    await expect(page.getByRole('menuitem', { name: 'Panel' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Projeler' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Projeler' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.getByRole('button', { name: 'Çalışma Alanı' }).click();
    await expect(page.getByRole('menuitem', { name: 'Test Koşuları' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Kilometre Taşları' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Raporlar' })).toBeVisible();
  });
});
