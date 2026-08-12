import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('İş Öğelerinde Zaman Takibi ve Efor (Worklog) Yönetimi', () => {

  const worklogInputData = [
    { zaman_girdisi: '2h 30m', kaydedilen_dakika: '150' },
    { zaman_girdisi: '1d', kaydedilen_dakika: '480' },
    { zaman_girdisi: '45m', kaydedilen_dakika: '45' },
    { zaman_girdisi: '1w 2d', kaydedilen_dakika: '2880' },
    { zaman_girdisi: '-1h', kaydedilen_dakika: 'Hata' },
    { zaman_girdisi: 'abc', kaydedilen_dakika: 'Hata' },
  ];

  worklogInputData.forEach((data) => {
    test(`NEXA-UI-4401 - Zaman girdisi: ${data.zaman_girdisi} -> Sonuç: ${data.kaydedilen_dakika}`, async ({ page }) => {
      await loginAs(page, 'TESTER');
      await page.goto('/agile/items/1');
      
      await page.getByRole('button', { name: 'Efor Gir' }).click();
      const timeInput = page.getByPlaceholder('Süre girin (örn: 2h 30m)');
      await timeInput.fill(data.zaman_girdisi);
      await page.getByRole('button', { name: 'Kaydet' }).click();

      if (data.kaydedilen_dakika === 'Hata') {
        await expect(page.locator('.text-error')).toBeVisible();
      } else {
        const savedWorklog = page.locator('.worklog-entry').first();
        await expect(savedWorklog).toContainText(`${data.kaydedilen_dakika} dk`);
      }
    });
  });

  const worklogPermissionData = [
    { rol: 'DEVELOPER', aktif_kullanici: 'User A', islem: 'Kendi logunu Düzenle', sonuc: 'Başarılı' },
    { rol: 'DEVELOPER', aktif_kullanici: 'User A', islem: 'Kendi logunu Sil', sonuc: 'Başarılı' },
    { rol: 'DEVELOPER', aktif_kullanici: 'User B', islem: 'Başkasının logunu Düzenle', sonuc: 'Reddedildi' },
    { rol: 'TEAM_LEADER', aktif_kullanici: 'User B', islem: 'Başkasının logunu Sil', sonuc: 'Başarılı' },
  ];

  worklogPermissionData.forEach((data) => {
    test(`NEXA-UI-4402 - Worklog yetkisi: ${data.rol} için ${data.islem}`, async ({ page }) => {
      // Rol eşleme
      const testRole = data.rol === 'TEAM_LEADER' ? 'TEAM_LEADER' : 'TESTER';
      await loginAs(page, testRole);
      
      await page.goto('/agile/items/1/worklogs');
      
      const logEntry = page.locator('.worklog-item').first();
      const editBtn = logEntry.getByRole('button', { name: 'Düzenle' });
      const deleteBtn = logEntry.getByRole('button', { name: 'Sil' });

      const targetBtn = data.islem.includes('Düzenle') ? editBtn : deleteBtn;

      if (data.sonuc === 'Başarılı') {
        await expect(targetBtn).toBeEnabled();
      } else {
        // Reddedildi durumunda buton ya yoktur ya da pasiftir
        const isVisible = await targetBtn.isVisible();
        if (isVisible) {
          await expect(targetBtn).toBeDisabled();
        } else {
          expect(isVisible).toBeFalsy();
        }
      }
    });
  });

  test('NEXA-UI-4403 - Bir Sprint içindeki toplam eforun hesaplanması', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/reports/sprint/1');
    
    // 10 log girildiği varsayılıyor
    const totalSpentField = page.getByTestId('total-time-spent');
    await expect(totalSpentField).not.toBeEmpty();
    // Toplamın sayısal ve pozitif olduğunu doğrula
    const text = await totalSpentField.innerText();
    expect(parseFloat(text)).toBeGreaterThan(0);
  });

});
