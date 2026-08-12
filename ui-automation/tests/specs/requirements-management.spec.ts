import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Gereksinim Yönetimi ve RTM (Requirements Traceability Matrix)', () => {

  const statusTransitionData = [
    { mevcut_statu: 'DRAFT', hedef_statu: 'IN_REVIEW', sonuc: 'Başarılı' },
    { mevcut_statu: 'IN_REVIEW', hedef_statu: 'APPROVED', sonuc: 'Başarılı' },
    { mevcut_statu: 'APPROVED', hedef_statu: 'DRAFT', sonuc: 'Başarılı' },
    { mevcut_statu: 'DRAFT', hedef_statu: 'APPROVED', sonuc: 'Engellendi' },
    { mevcut_statu: 'APPROVED', hedef_statu: 'ARCHIVED', sonuc: 'Başarılı' },
  ];

  statusTransitionData.forEach((data) => {
    test(`NEXA-UI-4701 - Gereksinim statü geçişi: ${data.mevcut_statu} -> ${data.hedef_statu}`, async ({ page }) => {
      await loginAs(page, 'TEAM_LEADER');
      await page.goto(`/requirements/1?status=${data.mevcut_statu}`);
      
      const statusBtn = page.getByTestId('req-status-dropdown');
      await statusBtn.click();
      await page.getByRole('option', { name: data.hedef_statu }).click();

      if (data.sonuc === 'Başarılı') {
        await expect(page.locator('.toast-success')).toBeVisible();
        await expect(statusBtn).toHaveText(data.hedef_statu);
      } else {
        await expect(page.locator('.toast-error')).toBeVisible();
        await expect(statusBtn).toHaveText(data.mevcut_statu);
      }
    });
  });

  const staleImpactData = [
    { bagli_oge: 'Test Case', etki_durumu: 'STALE' },
    { bagli_oge: 'WorkItem', etki_durumu: 'IMPACTED' },
    { bagli_oge: 'Test Run', etki_durumu: 'CLEAN' },
  ];

  staleImpactData.forEach((data) => {
    test(`NEXA-UI-4702 - Gereksinim değişimi etkisi: ${data.bagli_oge} -> ${data.etki_durumu}`, async ({ page }) => {
      await loginAs(page, 'TEAM_LEADER');
      await page.goto('/requirements/REQ-101');
      
      // Gereksinimi güncelle
      await page.getByRole('button', { name: 'Düzenle' }).click();
      await page.locator('textarea[name="description"]').fill('Güncellenmiş içerik');
      await page.getByRole('button', { name: 'Kaydet' }).click();

      // İzlenebilirlik matrisine veya bağlı öğeler sekmesine git
      await page.getByRole('tab', { name: 'İzlenebilirlik' }).click();
      
      const impactStatus = page.locator(`.impact-cell[data-type="${data.bagli_oge}"]`);
      await expect(impactStatus).toHaveText(data.etki_durumu);
    });
  });

  test('NEXA-UI-4703 - Farklı türde gereksinimlerin (Security, Performance) filtrelenmesi', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/requirements');
    
    const filterBtn = page.getByRole('button', { name: 'Filtrele' });
    await filterBtn.click();
    await page.getByLabel('Tip').selectOption('SECURITY');
    await page.getByRole('button', { name: 'Uygula' }).click();

    // Sadece Security olanların listelendiğini doğrula
    const rows = page.locator('.requirement-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('SECURITY');
    }
  });

});
