import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('Raporlar', () => {
  test('rapor listesi yeni kullanıcı için boş durumu gösterir', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible();
    await expect(page.getByText('Rapor bulunamadı')).toBeVisible();
  });

  test('takım lideri rapor detaylarını ve durum sekmelerini açabilir', async ({ page }) => {
    test.skip(isLiveMode, 'Rapor veri seti mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/reports');

    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await page.getByRole('link', { name: 'Sprint 24 Regresyon' }).click();

    await expect(page).toHaveURL(/\/reports\/run-sprint-24$/);
    await expect(page.getByRole('heading', { name: 'Rapor Detayları' })).toBeVisible();
    await expect(page.getByText('Yürütme Özeti')).toBeVisible();
    await expect(page.getByText('Kullanıcı başarılı şekilde giriş yapar')).toBeVisible();

    await page.getByRole('tab', { name: 'Başarısız (1)' }).click();
    await expect(page.getByText('Eski giriş akışı arşivden geri getirilebilir')).toBeVisible();
  });
});
