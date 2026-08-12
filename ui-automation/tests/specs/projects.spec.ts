import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('Projeler', () => {
  test('boş projeler ekranı yeni kullanıcıya açık durum gösterir', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Proje Portföy Yönetimi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aktif proje bulunamadı' })).toBeVisible();
  });

  test('takım lideri aktif ve arşivli projeleri filtreleyebilir ve projeye gidebilir', async ({ page }) => {
    test.skip(isLiveMode, 'Arşivli proje ve arama verisi mock workspace içinde tanımlı.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects');

    await expect(page.getByRole('cell', { name: 'Satış Portalı' })).toBeVisible();
    await expect(page.getByPlaceholder('Projeleri filtrele...')).toBeVisible();

    await page.getByPlaceholder('Projeleri filtrele...').fill('Satış');
    await expect(page.getByRole('cell', { name: 'Satış Portalı' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Eski Operasyon Paneli' })).not.toBeVisible();

    await page.getByPlaceholder('Projeleri filtrele...').fill('');
    await page.getByRole('tab', { name: 'Arşivlenmiş' }).click();
    await expect(page.getByRole('cell', { name: /Eski Operasyon Paneli/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Aktif Projeler' }).click();
    await page.locator('tr').filter({ hasText: 'Satış Portalı' }).click();

    await expect(page).toHaveURL(/\/p\/SALES$/);
    await expect(page.getByRole('heading', { name: 'Satış Portalı' })).toBeVisible();
  });
});
