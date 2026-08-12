import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('P0 test tasarımı ve otomasyon senaryoları', () => {
  test.skip(isLiveMode, 'P0 test tasarımı kapsamı mock suite, case ve otomasyon verisi gerektiriyor.');

  test('suite seçili açıldığında kimlik doğrulama senaryoları listelenir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=test-cases&suiteId=suite-auth');

    await expect(page.getByText('Kimlik Doğrulama')).toBeVisible();
    await expect(page.getByText('2 senaryo bulundu')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kullanıcı başarılı şekilde giriş yapar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hatalı parola reddedilir' })).toBeVisible();
  });

  test('etiket filtresi smoke senaryosunu negatif senaryodan ayırır', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=test-cases&suiteId=suite-auth');

    await page.getByRole('button', { name: 'Etiketleri Filtrele' }).click();
    await page.getByRole('menuitem', { name: /smoke/ }).click();

    await expect(page.locator('tbody tr').filter({ hasText: 'Kullanıcı başarılı şekilde giriş yapar' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Hatalı parola reddedilir' })).toHaveCount(0);
  });

  test('etiket filtresi ödeme kapsamındaki negatif vakayı daraltır', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=test-cases&suiteId=suite-payments');

    await page.getByRole('button', { name: 'Etiketleri Filtrele' }).click();
    await page.getByRole('menuitem', { name: /negative/ }).click();

    await expect(page.locator('tbody tr').filter({ hasText: 'Reddedilen ödeme açıklama verir' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Ödeme onayı tamamlanır' })).toHaveCount(0);
  });

  test('inline satırdan yeni test senaryosu oluşturulur', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=test-cases&suiteId=suite-auth');

    await page.getByPlaceholder('Test senaryosu ekle...').fill('Yeni kritik giriş kilidi kontrolü');
    await page.locator('select').selectOption('CRITICAL');
    await page.getByRole('button', { name: 'Ekle' }).click();

    await expect(page.getByRole('link', { name: 'Yeni kritik giriş kilidi kontrolü' })).toBeVisible();
    await expect(page.getByText('3 senaryo bulundu')).toBeVisible();
  });

  test('test senaryosu detayında manuel adımlar ve özellikler görünür', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales/cases/case-login-success');

    await expect(page.getByRole('tab', { name: 'Manuel' })).toBeVisible();
    await expect(page.getByText('Giriş ekranını aç')).toBeVisible();
    await expect(page.getByText('Kullanıcı paneline yönlendirilir')).toBeVisible();
    await expect(page.getByText('Ön Koşullar')).toBeVisible();
    await expect(page.getByText('Kullanıcı kayıtlı ve aktif olmalıdır.')).toBeVisible();
  });

  test('test senaryosu detayında manuel adım eklenebilir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales/cases/case-login-success');

    await page.getByPlaceholder('Yeni işlem ekle...').fill('Oturum çerezini kontrol et');
    await page.getByPlaceholder('Beklenen sonuç ekle...').fill('Güvenli çerez oluşur');
    await page.getByPlaceholder('Beklenen sonuç ekle...').press('Enter');

    await expect(page.getByText('Oturum çerezini kontrol et')).toBeVisible();
    await expect(page.getByText('Güvenli çerez oluşur')).toBeVisible();
  });

  test('otomasyon sekmesi mevcut senaryo akışını ve ortam değişkenini gösterir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales/cases/case-login-success');

    await page.getByRole('tab', { name: 'Otomasyon' }).click();
    await expect(page.getByRole('heading', { name: 'Senaryo Akışı' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Giriş sayfasını aç' })).toBeVisible();
    await expect(page.getByText('Panel başlığını doğrula', { exact: true }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Değişkenler' }).click();
    await expect(page.locator('input[value="BASE_URL"]')).toBeVisible();
    await expect(page.locator('input[value="http://127.0.0.1:5173"]')).toBeVisible();
  });

  test('otomasyon dry-run konsolu başarılı yürütme sonucunu açar', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales/cases/case-login-success');

    await page.getByRole('tab', { name: 'Otomasyon' }).click();
    await page.getByRole('button', { name: 'Testi Çalıştır' }).click();

    await expect(page.getByRole('dialog', { name: 'Test Yürütme Konsolu' })).toBeVisible();
    const consoleDialog = page.getByRole('dialog', { name: 'Test Yürütme Konsolu' });
    await expect(consoleDialog.getByText('BAŞARILI')).toBeVisible();
    await expect(consoleDialog.locator('span').filter({ hasText: /^Panel başlığını doğrula$/ })).toBeVisible();
  });
});
