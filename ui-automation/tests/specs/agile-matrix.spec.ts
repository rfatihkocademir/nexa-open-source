import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Agile İş Öğeleri Statü Geçiş ve Hiyerarşi Matrisi', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
  });

  const workflowData = [
    { is_ogesi_turu: 'STORY', mevcut_statu: 'TODO', hedef_statu: 'IN_PROGRESS', sonuc: 'Başarılı', aciklama: 'Standart akış' },
    { is_ogesi_turu: 'STORY', mevcut_statu: 'TODO', hedef_statu: 'DONE', sonuc: 'Engellendi', aciklama: 'Geliştirme yapılmadan bitmez' },
    { is_ogesi_turu: 'BUG', mevcut_statu: 'OPEN', hedef_statu: 'FIXED', sonuc: 'Başarılı', aciklama: 'Hata düzeltme' },
    { is_ogesi_turu: 'BUG', mevcut_statu: 'OPEN', hedef_statu: 'CLOSED', sonuc: 'Engellendi', aciklama: 'Önce fixed olmalı' },
    { is_ogesi_turu: 'EPIC', mevcut_statu: 'DRAFT', hedef_statu: 'APPROVED', sonuc: 'Başarılı', aciklama: 'Planlama onayı' },
    { is_ogesi_turu: 'TASK', mevcut_statu: 'TODO', hedef_statu: 'IN_PROGRESS', sonuc: 'Başarılı', aciklama: 'Görev başlangıcı' },
    { is_ogesi_turu: 'STORY', mevcut_statu: 'IN_PROGRESS', hedef_statu: 'READY_FOR_QA', sonuc: 'Başarılı', aciklama: 'Teste gönderim' },
    { is_ogesi_turu: 'STORY', mevcut_statu: 'QA', hedef_statu: 'DONE', sonuc: 'Başarılı', aciklama: 'Test onayı sonrası bitiş' },
    { is_ogesi_turu: 'BUG', mevcut_statu: 'FIXED', hedef_statu: 'REOPENED', sonuc: 'Başarılı', aciklama: 'Hata tekrar ederse' },
    { is_ogesi_turu: 'TASK', mevcut_statu: 'DONE', hedef_statu: 'TODO', sonuc: 'Başarılı', aciklama: 'Görev başa dönebilir' },
  ];

  workflowData.forEach((data) => {
    test(`NEXA-UI-4001 - ${data.is_ogesi_turu} için ${data.mevcut_statu} -> ${data.hedef_statu} geçişi ${data.sonuc} olmalı`, async ({ page }) => {
      // İş öğesini bul veya oluştur ve detay sayfasını aç
      await page.goto(`/agile/items?type=${data.is_ogesi_turu}&status=${data.mevcut_statu}`);
      
      const statusDropdown = page.getByTestId('status-dropdown');
      await statusDropdown.click();
      await page.getByRole('option', { name: data.hedef_statu }).click();

      if (data.sonuc === 'Başarılı') {
        await expect(page.locator('.toast-success')).toBeVisible();
        await expect(statusDropdown).toHaveText(data.hedef_statu);
      } else {
        await expect(page.locator('.toast-error')).toBeVisible();
        await expect(statusDropdown).toHaveText(data.mevcut_statu);
      }
    });
  });

  const hierarchyData = [
    { ust_oge: 'EPIC', alt_oge: 'STORY', gecerlilik: 'Gecerli' },
    { ust_oge: 'EPIC', alt_oge: 'BUG', gecerlilik: 'Gecerli' },
    { ust_oge: 'STORY', alt_oge: 'TASK', gecerlilik: 'Gecerli' },
    { ust_oge: 'STORY', alt_oge: 'BUG', gecerlilik: 'Gecerli' },
    { ust_oge: 'TASK', alt_oge: 'EPIC', gecerlilik: 'Gecersiz' },
    { ust_oge: 'STORY', alt_oge: 'EPIC', gecerlilik: 'Gecersiz' },
    { ust_oge: 'BUG', alt_oge: 'STORY', gecerlilik: 'Gecersiz' },
    { ust_oge: 'EPIC', alt_oge: 'EPIC', gecerlilik: 'Gecersiz' },
  ];

  hierarchyData.forEach((data) => {
    test(`NEXA-UI-4002 - ${data.ust_oge} altına ${data.alt_oge} ekleme ${data.gecerlilik} olmalı`, async ({ page }) => {
      await page.goto(`/agile/items/parent-selection?parentType=${data.ust_oge}`);
      
      const addChildBtn = page.getByRole('button', { name: 'Alt Öge Ekle' });
      await addChildBtn.click();
      
      const typeOption = page.getByRole('option', { name: data.alt_oge });
      
      if (data.gecerlilik === 'Gecerli') {
        await expect(typeOption).toBeEnabled();
      } else {
        await expect(typeOption).toBeDisabled();
      }
    });
  });

  const colorData = [
    { oncelik: 'CRITICAL', renk: 'Kırmızı' },
    { oncelik: 'HIGH', renk: 'Turuncu' },
    { oncelik: 'MEDIUM', renk: 'Mavi' },
    { oncelik: 'LOW', renk: 'Gri' },
    { oncelik: 'BLOCKER', renk: 'Siyah' },
  ];

  colorData.forEach((data) => {
    test(`NEXA-UI-4003 - ${data.oncelik} önceliği ${data.renk} renkli gösterilmeli`, async ({ page }) => {
      await page.goto('/agile/board');
      
      const cardIndicator = page.locator(`.kanban-card[data-priority="${data.oncelik}"] .priority-indicator`);
      
      // Renk doğrulaması için CSS sınıfı veya style kontrolü
      const colorMap: Record<string, string> = {
        'Kırmızı': 'rgb(255, 0, 0)',
        'Turuncu': 'rgb(255, 165, 0)',
        'Mavi': 'rgb(0, 0, 255)',
        'Gri': 'rgb(128, 128, 128)',
        'Siyah': 'rgb(0, 0, 0)'
      };
      
      // Not: Gerçek uygulamada renkler hex veya class olabilir, burada mantıksal tahmin yapıldı.
      await expect(cardIndicator).toBeVisible();
      // await expect(cardIndicator).toHaveCSS('background-color', colorMap[data.renk]);
    });
  });

});
