import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('Dashboard', () => {
  test('yeni bir kullanıcı boş dashboard ve sıfır proje özeti görür', async ({ page }) => {
    await loginAs(page, 'TESTER');

    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
    await expect(page.getByText('Toplam Proje').locator('..')).toContainText('0');
    await expect(page.getByText('Gösterilecek son aktivite yok.')).toBeVisible();
  });

  test('takım lideri proje kartlarını, KPI alanlarını ve kısa yolu görür', async ({ page }) => {
    test.skip(isLiveMode, 'Takım lideri mock workspace verisi gerekiyor.');

    await loginAs(page, 'TEAM_LEADER');

    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Satış Portalı/ })).toBeVisible();
    await expect(page.getByText('Yönetim KPI\'ları')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Deniz Kaya' })).toBeVisible();
    await expect(page.getByText('Sprint 24 Regresyon koşusu oluşturuldu')).toBeVisible();

    await page.getByRole('button', { name: 'Tümünü Gör' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Proje Portföy Yönetimi' })).toBeVisible();
  });
});
