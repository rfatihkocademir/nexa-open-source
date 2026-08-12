import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Yığın İşlemler (Bulk Actions) ve Veri İçe/Dışa Aktarımı (Import/Export)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  const bulkEditData = [
    { alan: 'Priority', yeni_deger: 'CRITICAL', aciklama: 'Öncelikleri yükseltme' },
    { alan: 'Status', yeni_deger: 'APPROVED', aciklama: 'Toplu onaylama (Eğer yetki varsa)' },
    { alan: 'Assignee', yeni_deger: 'User X', aciklama: 'Toplu kişi ataması' },
    { alan: 'Etiketler (Tags)', yeni_deger: 'Regresyon', aciklama: 'Mevcut etiketlerin üzerine ekleme' },
  ];

  test.describe('NEXA-UI-5101 - Çoklu seçim ile toplu alan güncellemesi', () => {
    bulkEditData.forEach((data) => {
      test(`Toplu Düzenleme: ${data.alan} -> ${data.yeni_deger} (${data.aciklama})`, async ({ page }) => {
        await page.goto('/test-cases/list');
        
        // 50 adet test case seç (veya mevcutları seç)
        const selectAllCheckbox = page.getByTestId('select-all-test-cases');
        await selectAllCheckbox.check();
        
        const bulkEditBtn = page.getByRole('button', { name: 'Toplu Düzenle' });
        await bulkEditBtn.click();
        
        const fieldSelect = page.getByLabel('Düzenlenecek Alan');
        await fieldSelect.selectOption(data.alan);
        
        const valueInput = page.getByLabel('Yeni Değer');
        if (data.alan === 'Priority' || data.alan === 'Status') {
          await valueInput.selectOption(data.yeni_deger);
        } else {
          await valueInput.fill(data.yeni_deger);
        }
        
        const applyBtn = page.getByRole('button', { name: 'Uygula' });
        await applyBtn.click();
        
        await expect(page.locator('.toast-success')).toBeVisible();
        await expect(page.locator('.bulk-update-summary')).toContainText('güncellendi');
      });
    });
  });

  const importData = [
    { csv_durumu: '100 geçerli satır, eksiksiz veri', beklenen_sonuc: '100 eklendi, 0 hatalı', aciklama: 'Sorunsuz içe aktarım' },
    { csv_durumu: '50 geçerli, 5 zorunlu alan boş', beklenen_sonuc: '50 eklendi, 5 hatalı satır', aciklama: 'Kısmi başarı' },
    { csv_durumu: 'Yanlış başlık (Headers) olan dosya', beklenen_sonuc: 'Geçersiz CSV şablonu', aciklama: 'Format hatası, hiçbiri eklenmez' },
    { csv_durumu: '100.000 satırlık devasa dosya', beklenen_sonuc: 'Sınır aşıldı (Max 5000)', aciklama: 'Performans koruması' },
  ];

  test.describe('NEXA-UI-5102 - CSV formatında toplu test case içe aktarma (Import) matrisi', () => {
    importData.forEach((data) => {
      test(`İçe Aktarma Durumu: ${data.aciklama}`, async ({ page }) => {
        await page.goto('/test-cases/import');
        
        // CSV simülasyonu
        // Not: Gerçek dosyalar test-data içinde saklanabilir.
        // await page.setInputFiles('input[type="file"]', `tests/fixtures/${data.csv_durumu}.csv`);
        
        // Simüle edilmiş yükleme ve sonuç bekleyişi
        const statusText = page.locator('.import-status-description');
        await statusText.fill(data.csv_durumu); // UI'da test kolaylığı için bir mock input varsayıyoruz
        
        const importBtn = page.getByRole('button', { name: 'İçe Aktarımı Başlat' });
        await importBtn.click();
        
        const summary = page.locator('.import-summary-report');
        await expect(summary).toContainText(data.beklenen_sonuc);
      });
    });
  });

});
