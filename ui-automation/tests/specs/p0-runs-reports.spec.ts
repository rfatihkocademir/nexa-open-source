import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('P0 koşu yürütme ve raporlama senaryoları', () => {
  test.skip(isLiveMode, 'P0 koşu ve rapor kapsamı mock test run verisi gerektiriyor.');

  test('global koşu araması koşuları başlığa göre filtreler', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs');

    await page.getByPlaceholder('Koşuları filtrele...').fill('Ödeme');

    await expect(page.getByRole('link', { name: 'Kritik Ödeme Onay Koşusu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).not.toBeVisible();
  });

  test('failed-runs odağı hatalı veya bloklu koşuları izole eder', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs?aiFocus=failed-runs');

    await expect(page.getByText('AI Focus: failed runs')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kritik Ödeme Onay Koşusu' })).toBeVisible();
  });

  test('koşu detayında durum metrikleri ve yürütme listesi görünür', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs/run-sprint-24');

    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await expect(page.getByText('Başarılı', { exact: true })).toBeVisible();
    await expect(page.getByText('Başarısız', { exact: true })).toBeVisible();
    await expect(page.getByText('Engellendi', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Kullanıcı başarılı şekilde giriş yapar' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Reddedilen ödeme açıklama verir' })).toBeVisible();
  });

  test('manuel yürütme diyaloğu adım, not ve kanıt alanlarını açar', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs/run-sprint-24');

    await page.getByRole('cell', { name: 'Kullanıcı başarılı şekilde giriş yapar' }).click();

    await expect(page.getByRole('dialog', { name: 'Kullanıcı başarılı şekilde giriş yapar' })).toBeVisible();
    await expect(page.getByText('E-posta adresini gir')).toBeVisible();
    await expect(page.getByPlaceholder('Gözlem veya yorum ekleyin...')).toBeVisible();
    await expect(page.getByText('Kanıt')).toBeVisible();
  });

  test('test edilmemiş senaryo başarılı işaretlenince satır durumu güncellenir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs/run-sprint-24');

    const row = page.locator('tr').filter({ hasText: 'Reddedilen ödeme açıklama verir' });
    await row.click();
    await page.getByRole('button', { name: 'Test Senaryosunu Geçir' }).click();

    await expect(row).toContainText('PASS');
  });

  test('başarısız senaryo test edilmedi durumuna sıfırlanabilir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/runs/run-sprint-24');

    const row = page.locator('tr').filter({ hasText: 'Eski giriş akışı arşivden geri getirilebilir' });
    await row.click();
    await page.getByTitle('Test Edilmedi Olarak İşaretle').last().click();
    await page.getByRole('button', { name: 'Sıfırla' }).click();

    await expect(row).toContainText('UNTESTED');
  });

  test('rapor detayında durum sekmeleri başarısız ve bloklu vakaları ayırır', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/reports/run-sprint-24');

    await expect(page.getByRole('heading', { name: 'Rapor Detayları' })).toBeVisible();
    await page.getByRole('tab', { name: 'Başarısız (1)' }).click();
    const failedRow = page.locator('tbody tr').filter({ hasText: 'Eski giriş akışı arşivden geri getirilebilir' });
    await expect(failedRow).toBeVisible();
    await expect(failedRow).toContainText('Beklenen hata metni görünmedi.');

    await page.getByRole('tab', { name: 'Engellendi (1)' }).click();
    await expect(page.getByText('Ödeme onayı tamamlanır')).toBeVisible();
  });

  test('tamamlanmış koşu raporu başarılı ve başarısız sonuç dağılımını gösterir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/reports/run-payments-01');

    await expect(page.getByRole('heading', { name: 'Rapor Detayları' })).toBeVisible();
    await expect(page.getByText('Başarılı: 3')).toBeVisible();
    await expect(page.getByText('Başarısız: 1')).toBeVisible();
    await page.getByRole('tab', { name: 'Başarılı (3)' }).click();
    await expect(page.getByText('Ödeme onayı tamamlanır')).toBeVisible();
  });
});
