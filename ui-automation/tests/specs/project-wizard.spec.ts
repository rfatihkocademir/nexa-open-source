import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';
import { openCreateProjectWizard } from '../support/ui';

test.describe('Proje kurulum sihirbazı', () => {
  test('isim girilmeden ilerlenirse doğrulama mesajı gösterir', async ({ page }) => {
    test.skip(isLiveMode, 'Proje kurulum sihirbazı mock AI verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await openCreateProjectWizard(page);

    await page.getByRole('button', { name: 'Sonraki Adım' }).click();
    await expect(page.getByText('Lütfen önce bir proje ismi girin.')).toBeVisible();
  });

  test('sihirbaz kapsam ve mimari aşamalarını geçip yeni proje oluşturur', async ({ page }) => {
    test.skip(isLiveMode, 'Proje kurulum sihirbazı mock AI verisi gerektiriyor.');

    await loginAs(page, 'TEAM_LEADER');
    await openCreateProjectWizard(page);

    await page.getByPlaceholder(/E-Ticaret Platformu/i).fill('Yeni Uçtan Uca Proje');
    await page.getByPlaceholder(/kısa bir özet/i).fill('Türkçe BDD ile oluşturulan test projesi');
    await page.getByRole('button', { name: 'Sonraki Adım' }).click();

    await expect(page.getByText('Bu projenin birincil kullanıcıları kimlerdir?')).toBeVisible();
    await page.getByRole('button', { name: 'Analizi Atla' }).click();

    await expect(page.getByRole('tab').first()).toBeVisible();
    await page.locator('.ProseMirror').first().fill('Satış portalı için kapsam metni.');
    await page.getByRole('button', { name: 'Sonraki Adım' }).click();

    await expect(page.getByText('Hangi teknoloji yığını kullanılacak?')).toBeVisible();
    await page.getByRole('button', { name: 'Analizi Atla' }).click();

    await expect(page.getByText('Takım Üyeleri', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Ad veya e-posta ile ara...').fill('Deniz');
    await page.getByRole('button', { name: /Deniz Kaya/ }).click();

    await page.getByRole('button', { name: 'Proje Oluştur' }).click();

    await expect(page.getByRole('cell', { name: /Yeni Uçtan Uca Proje/ })).toBeVisible({ timeout: 20_000 });
  });
});
