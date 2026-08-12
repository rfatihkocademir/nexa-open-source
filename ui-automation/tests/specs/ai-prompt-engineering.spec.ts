import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('AI Prompt Şablonları (Templates) ve Versiyonlama Matrisi', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  const promptData = [
    { hedef_tip: 'Test Case Uretimi', yeni_icerik: 'Lütfen BDD formatında yaz', sonuc: 'Başarılı', aciklama: 'Geçerli içerik güncellenir' },
    { hedef_tip: 'Bug Raporu Ozeti', yeni_icerik: '', sonuc: 'Hata', aciklama: 'Şablon boş olamaz' },
    { hedef_tip: 'Release Analizi', yeni_icerik: 'Sadece JSON dön: {}', sonuc: 'Başarılı', aciklama: 'JSON çıktı formatı zorlama' },
  ];

  promptData.forEach((data) => {
    test(`NEXA-UI-4601 - ${data.hedef_tip} için prompt güncelleme: ${data.sonuc}`, async ({ page }) => {
      await page.goto('/settings/ai-prompts');
      
      await page.getByRole('link', { name: data.hedef_tip }).click();
      const editor = page.locator('.monaco-editor').first();
      await editor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(data.yeni_icerik);
      
      await page.getByRole('button', { name: 'Kaydet' }).click();

      if (data.sonuc === 'Başarılı') {
        await expect(page.locator('.toast-success')).toBeVisible();
      } else {
        await expect(page.locator('.toast-error')).toBeVisible();
      }
    });
  });

  test('NEXA-UI-4602 - Prompt şablonunda önceki versiyona dönme (Rollback)', async ({ page }) => {
    await page.goto('/settings/ai-prompts');
    await page.getByRole('link', { name: 'Test Case Üretimi' }).click();
    
    const versionHistoryBtn = page.getByRole('button', { name: 'Versiyon Geçmişi' });
    await versionHistoryBtn.click();
    
    const v1Row = page.locator('.version-row', { hasText: 'V1' });
    await v1Row.getByRole('button', { name: 'Aktif Yap' }).click();
    
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.active-version-badge')).toHaveText('V1');
  });

});
