import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';
import { openCreateProjectWizard } from '../support/ui';

test.describe('P0 proje portföyü ve kurulum sihirbazı senaryoları', () => {
  test.skip(isLiveMode, 'P0 proje kapsamı mock proje, AI ve rol verisi gerektiriyor.');

  test('tester proje oluşturma aksiyonunu başlatamaz', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Proje Portföy Yönetimi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proje Oluştur' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Proje Kurulumu' })).toHaveCount(0);
  });

  test('dashboard üzerindeki proje oluştur kısayolu portföyde sihirbazı açar', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');

    await page.getByRole('button', { name: 'Proje Oluştur' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Proje Portföy Yönetimi' })).toBeVisible();
    const createButton = page.getByRole('main').getByRole('button', { name: 'Proje Oluştur' });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('heading', { name: 'Proje Kurulumu' })).toBeVisible();
  });

  test('dashboard proje kartı doğru proje detayına gider', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');

    await page.getByRole('button', { name: /Satış Portalı/ }).click();

    await expect(page).toHaveURL(/\/projects\/project-sales\?tab=overview$/);
    await expect(page.getByRole('heading', { name: 'Satış Portalı' })).toBeVisible();
  });

  test('aktif proje araması sonuçsuz ve sonuçlu durumları ayırır', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects');

    const filter = page.getByPlaceholder('Projeleri filtrele...');
    await filter.fill('bulunmayan-proje');
    await expect(page.getByRole('heading', { name: 'Aktif proje bulunamadı' })).toBeVisible();

    await filter.fill('Satış');
    await expect(page.getByRole('cell', { name: 'Satış Portalı' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aktif proje bulunamadı' })).toHaveCount(0);
  });

  test('arşiv sekmesi aktif projeden arşivli projeye geçişi izole eder', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects');

    await page.getByRole('tab', { name: 'Arşivlenmiş' }).click();
    await expect(page.getByRole('cell', { name: /Eski Operasyon Paneli/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Satış Portalı' })).not.toBeVisible();

    await page.getByRole('tab', { name: 'Aktif Projeler' }).click();
    await expect(page.getByRole('cell', { name: 'Satış Portalı' })).toBeVisible();
  });

  test('proje genel bakışı aktif kalite ve teslimat sinyallerini gösterir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales');

    await expect(page.getByRole('heading', { name: 'Satış Portalı' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sprint 24' })).toBeVisible();
    await expect(page.getByText('Ödeme akışındaki sürtünmeleri azaltmak')).toBeVisible();
    await expect(page.getByText('Toplam Test Senaryoları')).toBeVisible();
  });

  test('sihirbaz AI görüşmesinde öneri seçimi cevap alanına işlenir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await openCreateProjectWizard(page);

    await page.getByPlaceholder(/E-Ticaret Platformu/i).fill('Müşteri Portalı');
    await page.getByPlaceholder(/kısa bir özet/i).fill('Müşteri self servis akışı');
    await page.getByRole('button', { name: 'Sonraki Adım' }).click();

    await expect(page.getByText('Bu projenin birincil kullanıcıları kimlerdir?')).toBeVisible();
    await page.getByRole('button', { name: 'Müşteriler' }).click();
    await expect(page.getByPlaceholder('Cevabınızı buraya yazın...').first()).toHaveValue('Müşteriler');
  });

  test('sihirbaz geri adımı proje adını ve açıklamasını korur', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await openCreateProjectWizard(page);

    await page.getByPlaceholder(/E-Ticaret Platformu/i).fill('Regresyon Portalı');
    await page.getByPlaceholder(/kısa bir özet/i).fill('Kritik regresyon kapsamı');
    await page.getByRole('button', { name: 'Sonraki Adım' }).click();
    await expect(page.getByText('Bu projenin birincil kullanıcıları kimlerdir?')).toBeVisible();

    await page.getByRole('button', { name: 'Geri' }).click();

    await expect(page.getByPlaceholder(/E-Ticaret Platformu/i)).toHaveValue('Regresyon Portalı');
    await expect(page.getByPlaceholder(/kısa bir özet/i)).toHaveValue('Kritik regresyon kapsamı');
  });
});
