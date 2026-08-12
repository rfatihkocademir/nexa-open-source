import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('Test koşuları', () => {
  test('koşu listesi yeni kullanıcı için boş durumu gösterir', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/runs');

    await expect(page.getByRole('heading', { name: 'Test Koşuları' })).toBeVisible();
    await expect(page.getByText('Test koşusu bulunamadı.')).toBeVisible();
  });

  test('takım lideri açık koşuları filtreleyip detay ekranına geçebilir', async ({ page }) => {
    test.skip(isLiveMode, 'Koşu listesi ve detay akışı mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs?aiFocus=open-runs');

    await expect(page.getByText('AI Focus: open runs')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await expect(page.getByText('Kritik Ödeme Onay Koşusu')).not.toBeVisible();

    await page.getByRole('link', { name: 'Sprint 24 Regresyon' }).click();

    await expect(page).toHaveURL(/\/runs\/run-sprint-24$/);
    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Yürütme Listesi' })).toBeVisible();
    await expect(page.getByText('Kullanıcı başarılı şekilde giriş yapar')).toBeVisible();
  });
});
