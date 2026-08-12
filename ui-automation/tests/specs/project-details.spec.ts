import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('Proje detayları', () => {
  test('eski proje adresini ekip ve proje slug içeren canonical adrese taşır', async ({ page }) => {
    test.skip(isLiveMode, 'Canonical URL yönlendirmesi mock workspace verisi gerektiriyor.');
    await loginAs(page, 'TEAM_LEADER');

    await page.goto('/projects/project-sales?tab=board');

    await expect(page).toHaveURL(/\/workspace\/sales\/board$/);
    await expect(page.getByRole('heading', { name: /Agile Board/i })).toBeVisible();
  });

  test('genel bakış sekmesi aktif sprinti ve kalite özetini gösterir', async ({ page }) => {
    test.skip(isLiveMode, 'Proje detayları mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales');

    await expect(page.getByRole('heading', { name: 'Satış Portalı' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sprint 24' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: "Board'a Git" })).toBeVisible();
    await expect(page.getByText('Toplam Test Senaryoları')).toBeVisible();
    await expect(page.getByText('Hata Durumu')).toBeVisible();
    await expect(page.getByText('Kalite Güvencesi')).toBeVisible();
  });

  test('test koşuları sekmesi proje koşularını listeler', async ({ page }) => {
    test.skip(isLiveMode, 'Proje koşu sekmesi mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=runs');

    await expect(page.getByRole('heading', { name: 'Test Koşuları', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sprint 24 Regresyon' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kritik Ödeme Onay Koşusu' })).toBeVisible();
    await expect(
      page.locator('tr').filter({ hasText: 'Kritik Ödeme Onay Koşusu' }),
    ).toContainText('100%');
  });

  test('test senaryoları sekmesi bir paketi seçip senaryoları gösterir', async ({ page }) => {
    test.skip(isLiveMode, 'Test setleri ve senaryolar mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=test-cases');

    await expect(page.getByRole('button', { name: 'Kimlik Doğrulama' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ödeme Akışları' })).toBeVisible();

    await page.getByRole('button', { name: 'Kimlik Doğrulama' }).click();
    await expect(page.getByText('Kullanıcı başarılı şekilde giriş yapar')).toBeVisible();
    await expect(page.getByText('Hatalı parola reddedilir')).toBeVisible();
  });

  test('buglar ekranı proje hatalarını listeler ve önem seviyesine göre filtreler', async ({ page }) => {
    test.skip(isLiveMode, 'Bug listesi mock workspace verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/p/SALES/bugs');

    await expect(page).toHaveURL(/\/p\/SALES\/bugs$/);
    await expect(page.getByRole('heading', { name: 'Buglar' })).toBeVisible();
    await expect(page.getByText('Ödeme onayı zaman aşımı')).toBeVisible();
    await expect(page.getByText('Hatalı parola bildirimi görünmüyor')).toBeVisible();
    await expect(page.getByRole('link', { name: /Ödeme onayı zaman aşımı/ })).toHaveAttribute('href', /^\/b\//);

    await page.getByLabel('Önem seviyesi').click();
    await page.getByRole('option', { name: 'Kritik' }).click();

    await expect(page.getByText('Ödeme onayı zaman aşımı')).toBeVisible();
    await expect(page.getByText('Hatalı parola bildirimi görünmüyor')).not.toBeVisible();
  });

  test('geçersiz proje adresi bulunamadı ekranına düşer', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/projects/olmayan-proje');

    await expect(page.getByRole('heading', { name: 'Proje bulunamadı' })).toBeVisible();
    await expect(page.getByText('Aradığınız proje mevcut değil veya görüntüleme izniniz yok.')).toBeVisible();
  });
});
