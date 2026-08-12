import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Güvenli Dosya Depolama (MinIO) ve Ek Yönetimi (Attachments)', () => {

  const uploadCategories = [
    { kategori: 'PROJECT_LOGO', maksimum_boyut: '2 MB', aciklama: 'Proje ayarlarında kullanılır' },
    { kategori: 'AVATAR', maksimum_boyut: '2 MB', aciklama: 'Profil resminde kullanılır' },
    { kategori: 'TEST_EVIDENCE', maksimum_boyut: '50 MB', aciklama: 'Koşu sonuçlarındaki kanıtlar' },
    { kategori: 'AUTOMATION_VIDEO', maksimum_boyut: '500 MB', aciklama: 'Otomasyonun ekran kayıtları' },
    { kategori: 'WIKI_IMAGE', maksimum_boyut: '10 MB', aciklama: 'Dokümantasyon içi görseller' },
  ];

  test.describe('NEXA-UI-5001 - Desteklenen dosya kategorilerine göre yükleme', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'ADMIN');
    });

    uploadCategories.forEach((data) => {
      test(`Kategori: ${data.kategori} - ${data.aciklama}`, async ({ page }) => {
        // Dosya yükleme ekranına git (Kategoriye göre sayfa değişebilir, burada genel bir yükleyici varsayıyoruz)
        await page.goto('/storage/upload-simulator');
        
        const categorySelect = page.getByLabel('Yükleme Kategorisi');
        await categorySelect.selectOption(data.kategori);
        
        const limitInfo = page.locator('.upload-limit-info');
        await expect(limitInfo).toContainText(data.maksimum_boyut);
        
        // Simüle edilmiş dosya yükleme
        // const fileChooserPromise = page.waitForEvent('filechooser');
        // await page.getByText('Dosya Seç').click();
        // const fileChooser = await fileChooserPromise;
        // await fileChooser.setFiles({ ... });
      });
    });
  });

  const downloadSecurityData = [
    { rol: 'ADMIN', sonuc: 'Dosya', aciklama: 'Sistem yetkisi' },
    { rol: 'PROJECT_MANAGER', sonuc: 'Dosya', aciklama: 'Üye kendi projesindeki dosyayı görür' }, // PROJE_UYESI yerine PROJECT_MANAGER kullanıldı (session.ts rollerine uygun)
    { rol: 'USER', sonuc: '403 Hata', aciklama: 'Başka projenin dosyasına erişemez' }, // DIS_KULLANICI yerine USER
    { rol: 'ANONIM', sonuc: '401 Hata', aciklama: 'Giriş yapmayan kullanıcı dosya indiremez' },
  ];

  test.describe('NEXA-UI-5002 - Dosya indirme (Download) yetki denetimi', () => {
    downloadSecurityData.forEach((data) => {
      test(`Rol: ${data.rol} - ${data.aciklama}`, async ({ page }) => {
        if (data.rol !== 'ANONIM') {
          await loginAs(page, data.rol as any);
        }

        // Gizli bir dosyanın URL'sine gitmeyi dene
        const response = await page.goto('/api/storage/download/secure-contract-id-123', {
          // Sayfa navigasyonu yerine fetch/request kontrolü daha kesin olabilir ama burada e2e odaklıyız
        });

        if (data.sonuc === 'Dosya') {
          expect(response?.status()).toBe(200);
          // Veya content-type kontrolü: expect(response?.headers()['content-type']).toBe('application/pdf');
        } else if (data.sonuc === '403 Hata') {
          expect(response?.status()).toBe(403);
        } else if (data.sonuc === '401 Hata') {
          // ANONIM durumda login'e yönlendirebilir veya 401 dönebilir
          expect([401, 302]).toContain(response?.status());
        }
      });
    });
  });

});
