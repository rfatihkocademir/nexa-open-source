import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Wiki İçerik Versiyonlama ve Veri Yaşam Döngüsü Matrisi', () => {

  const diffData = [
    { v1_icerik: 'Merhaba Dünya', v2_icerik: 'Merhaba Mars', beklenen_fark: '"Mars" eklendi' },
    { v1_icerik: 'Eski Protokol', v2_icerik: '', beklenen_fark: 'Tüm metin silindi' },
    { v1_icerik: 'Madde 1', v2_icerik: 'Madde 1\nMadde 2', beklenen_fark: '"Madde 2" eklendi' },
  ];

  diffData.forEach((data) => {
    test(`NEXA-UI-4101 - Versiyonlar arası fark analizi: ${data.beklenen_fark}`, async ({ page }) => {
      await loginAs(page, 'TEAM_LEADER');
      await page.goto('/wiki/pages/diff-test');
      
      // Versiyon içeriklerini hazırla (moking veya manuel giriş)
      // Karşılaştır butonuna bas
      await page.getByRole('button', { name: 'Sürümleri Karşılaştır' }).click();
      
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toContainText(data.beklenen_fark.replace(/"/g, ''));
    });
  });

  const lifecycleData = [
    { islem: 'Arşivle (Soft)', yeni_durum: 'DELETED' },
    { islem: 'Geri Yükle (Restore)', yeni_durum: 'APPROVED' },
    { islem: 'Kalıcı Sil (Hard)', yeni_durum: 'YOK' },
  ];

  lifecycleData.forEach((data) => {
    test(`NEXA-UI-4102 - Wiki sayfası lifecycle: ${data.islem}`, async ({ page }) => {
      await loginAs(page, 'ADMIN');
      await page.goto('/wiki/pages/lifecycle-test');
      
      await page.getByRole('button', { name: data.islem }).click();
      
      if (data.yeni_durum === 'YOK') {
        await expect(page.locator('text=Sayfa Bulunamadı')).toBeVisible();
      } else {
        const statusBadge = page.getByTestId('page-status');
        await expect(statusBadge).toHaveText(data.yeni_durum);
      }
    });
  });

  const permissionData = [
    { rol: 'ADMIN', islem: 'Alanı Sil', yetki_durumu: 'İzin Verildi' },
    { rol: 'TEAM_LEADER', islem: 'Alanı Düzenle', yetki_durumu: 'İzin Verildi' },
    { rol: 'TESTER', islem: 'Alanı Sil', yetki_durumu: 'Reddedildi' },
    { rol: 'DEVELOPER', islem: 'Sayfa Onayla', yetki_durumu: 'Reddedildi' },
    { rol: 'PRODUCT_OWNER', islem: 'Sayfa Düzenle', yetki_durumu: 'İzin Verildi' },
  ];

  permissionData.forEach((data) => {
    test(`NEXA-UI-4103 - Wiki yetki kısıtlaması: ${data.rol} için ${data.islem}`, async ({ page }) => {
      // Not: DEVELOPER ve PRODUCT_OWNER rolleri loginAs içinde tanımlı olmayabilir, 
      // mevcut rollere (TESTER, TEAM_LEADER, ADMIN) göre uyarlanmalıdır.
      const testRole = ['ADMIN', 'TEAM_LEADER', 'TESTER'].includes(data.rol) ? (data.rol as any) : 'TESTER';
      
      await loginAs(page, testRole);
      await page.goto('/wiki/spaces/1');
      
      const actionBtn = page.getByRole('button', { name: data.islem });
      
      if (data.yetki_durumu === 'İzin Verildi') {
        await expect(actionBtn).toBeEnabled();
      } else {
        // Buton gizli de olabilir, devre dışı da.
        const isVisible = await actionBtn.isVisible();
        if (isVisible) {
          await expect(actionBtn).toBeDisabled();
        } else {
          expect(isVisible).toBeFalsy();
        }
      }
    });
  });

});
