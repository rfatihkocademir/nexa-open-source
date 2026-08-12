import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('Entegrasyon Olayları ve Bildirim Tetikleme Matrisi', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  const slackData = [
    { olay: 'Test Koşusu Fail', beklenen_anahtar_kelime: 'FAILED', aciklama: 'Hata durum bildirimi' },
    { olay: 'Kritik Bug Açıldı', beklenen_anahtar_kelime: 'CRITICAL', aciklama: 'Öncelikli hata bildirimi' },
    { olay: 'Sürüm Onaylandı', beklenen_anahtar_kelime: 'READY', aciklama: 'Release hazır bildirimi' },
    { olay: 'Yeni Üye Daveti', beklenen_anahtar_kelime: 'Davet Edildi', aciklama: 'Organizasyonel bildirim' },
  ];

  slackData.forEach((data) => {
    test(`NEXA-UI-4201 - Slack bildirimi içeriği: ${data.olay}`, async ({ page }) => {
      await page.goto('/settings/integrations/slack/logs');
      
      const latestLog = page.locator('.integration-log-entry').first();
      await expect(latestLog).toContainText(data.beklenen_anahtar_kelime);
    });
  });

  const jiraData = [
    { nexa_tipi: 'BUG', jira_tipi: 'Bug', aciklama: 'Hata eşleşmesi' },
    { nexa_tipi: 'STORY', jira_tipi: 'Story', aciklama: 'Hikaye eşleşmesi' },
    { nexa_tipi: 'EPIC', jira_tipi: 'Epic', aciklama: 'Hiyerarşi eşleşmesi' },
    { nexa_tipi: 'TASK', jira_tipi: 'Task', aciklama: 'Görev eşleşmesi' },
  ];

  jiraData.forEach((data) => {
    test(`NEXA-UI-4202 - Jira senkronizasyon matrisi: ${data.nexa_tipi} -> ${data.jira_tipi}`, async ({ page }) => {
      await page.goto('/settings/integrations/jira/mapping');
      
      const mappingRow = page.locator('.mapping-row', { hasText: data.nexa_tipi });
      await expect(mappingRow.getByRole('combobox')).toHaveValue(data.jira_tipi);
    });
  });

  const emailData = [
    { olay: 'Şifre Sıfırlama', alici_rolu: 'Kullanıcının Kendisi', aciklama: 'Güvenlik akışı' },
    { olay: 'Yeni Proje Oluşturma', alici_rolu: 'ADMIN', aciklama: 'Sistem izleme' },
    { olay: 'Test Ataması', alici_rolu: 'TESTER', aciklama: 'Görev ataması' },
    { olay: 'Sürüm Onay Bekliyor', alici_rolu: 'PRODUCT_OWNER', aciklama: 'Karar verici bildirimi' },
  ];

  emailData.forEach((data) => {
    test(`NEXA-UI-4203 - E-posta bildirim dağıtımı: ${data.olay} -> ${data.alici_rolu}`, async ({ page }) => {
      await page.goto('/settings/notifications/email');
      
      const notificationSetting = page.locator('.notification-setting', { hasText: data.olay });
      await expect(notificationSetting.locator('.recipient-role')).toContainText(data.alici_rolu);
    });
  });

});
