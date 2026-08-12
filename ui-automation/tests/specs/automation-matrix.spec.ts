import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Otomasyon Adımları ve Değişken Kapsamı Matrisi', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  const variableHierarchy = [
    { seviye_1: 'Sistem', seviye_2: 'Proje', oncelikli_deger: 'Proje Değeri', aciklama: 'Proje sistem değerini ezer' },
    { seviye_1: 'Proje', seviye_2: 'Senaryo', oncelikli_deger: 'Senaryo Değeri', aciklama: 'Senaryo proje değerini ezer' },
    { seviye_1: 'Senaryo', seviye_2: 'Ortam', oncelikli_deger: 'Ortam Değeri', aciklama: 'Ortam (QA/Prod) en önceliklidir' },
  ];

  variableHierarchy.forEach((data) => {
    test(`NEXA-UI-4301 - Değişken hiyerarşisi: ${data.seviye_1} vs ${data.seviye_2} -> ${data.oncelikli_deger}`, async ({ page }) => {
      await page.goto('/automation/variable-preview');
      
      await page.getByLabel('Seviye 1').selectOption(data.seviye_1);
      await page.getByLabel('Seviye 2').selectOption(data.seviye_2);
      
      const effectiveValue = page.locator('.effective-value-display');
      await expect(effectiveValue).toHaveText(data.oncelikli_deger);
    });
  });

  const stepTypes = [
    { adim_tipi: 'Tıklama', zorunlu_alan: 'Locator', aciklama: 'Buton/Link seçimi' },
    { adim_tipi: 'Metin Yazma', zorunlu_alan: 'Değer (Value)', aciklama: 'Input verisi' },
    { adim_tipi: 'Bekleme', zorunlu_alan: 'Süre (ms)', aciklama: 'Statik bekleme' },
    { adim_tipi: 'Kontrol (Assert)', zorunlu_alan: 'Beklenen Veri', aciklama: 'Doğrulama kriteri' },
    { adim_tipi: 'Sayfaya Git', zorunlu_alan: 'URL', aciklama: 'Navigasyon' },
  ];

  stepTypes.forEach((data) => {
    test(`NEXA-UI-4302 - Otomasyon adımı validation: ${data.adim_tipi}`, async ({ page }) => {
      await page.goto('/automation/builder');
      
      await page.getByRole('button', { name: 'Adım Ekle' }).click();
      await page.getByLabel('Adım Tipi').selectOption(data.adim_tipi);
      
      await page.getByRole('button', { name: 'Kaydet' }).click();
      
      const errorMsg = page.locator('.field-error', { hasText: data.zorunlu_alan });
      await expect(errorMsg).toBeVisible();
    });
  });

  const errorHandling = [
    { hata_turu: 'Element Bulunamadı', aksiyon: 'Senaryoyu Durdur', aciklama: 'Kritik hata' },
    { hata_turu: 'Timeout', aksiyon: 'Yeniden Dene (Retry 3x)', aciklama: 'Ağ/Yüklenme gecikmesi' },
    { hata_turu: 'Assert Fail', aksiyon: 'Hata Logu Kaydet', aciklama: 'Beklenen sonuç uyuşmazlığı' },
  ];

  errorHandling.forEach((data) => {
    test(`NEXA-UI-4303 - Hata yönetimi: ${data.hata_turu} -> ${data.aksiyon}`, async ({ page }) => {
      await page.goto('/automation/settings/error-handling');
      
      const configRow = page.locator('.error-config-row', { hasText: data.hata_turu });
      await expect(configRow.locator('.action-selector')).toHaveText(data.aksiyon);
    });
  });

});
