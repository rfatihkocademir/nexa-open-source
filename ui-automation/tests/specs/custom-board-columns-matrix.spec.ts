import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Özelleştirilebilir Kanban Board Kolonları ve WIP Limitleri', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  const columnData = [
    { islem: 'Yeni Kolon Ekle', veri: 'Testing', sonuc: 'Başarılı', aciklama: 'Yeni kolon boarda gelir' },
    { islem: 'Limit (WIP) Ayarla', veri: '5', sonuc: 'Başarılı', aciklama: 'Maksimum kart sınırı' },
    { islem: 'Limit (WIP) Ayarla', veri: '-1', sonuc: 'Hata', aciklama: 'Negatif limit olamaz' },
    { islem: 'Kolon Sil', veri: 'Testing', sonuc: 'Başarılı', aciklama: 'Kolon arşivlenir (Soft)' },
  ];

  columnData.forEach((data) => {
    test(`NEXA-UI-4501 - ${data.islem} işlemi: ${data.veri} -> ${data.sonuc} (${data.aciklama})`, async ({ page }) => {
      await page.goto('/settings/agile');

      if (data.islem === 'Yeni Kolon Ekle') {
        await page.getByRole('button', { name: 'Yeni Kolon Ekle' }).click();
        await page.getByLabel('Kolon Adı').fill(data.veri);
        await page.getByRole('button', { name: 'Kaydet' }).click();
      } else if (data.islem === 'Limit (WIP) Ayarla') {
        const columnSettings = page.locator('.column-settings-item').first();
        await columnSettings.getByRole('button', { name: 'Düzenle' }).click();
        await page.getByLabel('WIP Limiti').fill(data.veri);
        await page.getByRole('button', { name: 'Kaydet' }).click();
      } else if (data.islem === 'Kolon Sil') {
        const column = page.locator('.column-settings-item', { hasText: data.veri });
        await column.getByRole('button', { name: 'Sil' }).click();
        await page.getByRole('button', { name: 'Onayla' }).click();
      }

      if (data.sonuc === 'Başarılı') {
        await expect(page.locator('.toast-success')).toBeVisible();
      } else {
        await expect(page.locator('.toast-error')).toBeVisible();
      }
    });
  });

  test('NEXA-UI-4502 - WIP (Work In Progress) limitinin aşılması', async ({ page }) => {
    await page.goto('/agile/board');
    
    const sourceCard = page.locator('.kanban-card').first();
    const targetColumn = page.locator('.kanban-column', { hasText: 'In Progress' });
    
    await sourceCard.dragTo(targetColumn);
    
    await expect(page.locator('.wip-limit-warning')).toBeVisible();
    await expect(page.getByText('WIP limiti aşıldı')).toBeVisible();
  });

});
