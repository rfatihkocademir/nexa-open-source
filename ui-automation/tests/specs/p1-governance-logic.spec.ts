import { expect, test } from '@playwright/test';

/**
 * BU TEST DOSYASI GERÇEK SİSTEM HATALARINI BULMAK VE DOĞRULAMAK İÇİN KURGULANMIŞTIR.
 * Doğrudan canlı backend ve veritabanı üzerinden koşar.
 */
test.describe('E2E - Real System Governance and Logic Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Seeder ile oluşturulan hesapla giriş
    await page.goto('/login');
    await page.getByLabel(/e-posta/i).fill('ayse.leader@nexa.test');
    await page.getByLabel(/şifre/i).fill('Password123!');
    await page.getByRole('button', { name: /giriş/i }).click();
    
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('NEXA-BUG-CHECK-01: Kritik buglar varken sürüm READY yapılamamalı', async ({ page }) => {
    // rc-v1 seeder ile oluşturuldu, 2 kritik bug içeriyor
    await page.goto('/projects/project-sales/releases/rc-v1');
    
    // Sayfa başlığını doğrula
    await expect(page.locator('h1')).toContainText(/Release V1/i);

    // Durumu değiştirme butonuna bas (Yeni eklediğimiz buton)
    await page.getByRole('button', { name: /DRAFT/i }).click();
    await page.getByRole('menuitem', { name: /READY/i }).click();

    // Backend'de eklediğimiz kuralın UI'da hata mesajı olarak görünmesini bekle
    await expect(page.getByText(/kritik hatalar çözülmeden/i)).toBeVisible();
  });

  test('NEXA-BUG-CHECK-02: AI Asistanı giriş alanı render edilmeli', async ({ page }) => {
    // Project Assistant tabına git
    await page.goto('/projects/project-sales?tab=project-memory');
    
    // Yeni eklediğimiz test-id ile kontrol et
    const chatInput = page.getByTestId('ai-assistant-input');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await chatInput.fill('E2E Test: Sistem ayakta mı?');
    await page.keyboard.press('Enter');

    // Not: AI servisi tam bağlı olmayabilir ama giriş alanının çalışması Major bir düzeltmedir.
  });

  test('NEXA-BUG-CHECK-03: Yetki izolasyonu ve 403 yönlendirmesi', async ({ page }) => {
    // Yetkisiz proje
    await page.goto('/projects/admin-only-project-id');
    
    // Yeni düzelttiğimiz yönlendirme mantığı (/403)
    await expect(page).toHaveURL(/\/403/);
    await expect(page.getByText(/forbidden|yetkiniz yok/i)).toBeVisible();
  });
});
