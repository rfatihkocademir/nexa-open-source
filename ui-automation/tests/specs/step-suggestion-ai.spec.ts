import { test, expect } from '@playwright/test';
import { loginAs } from '../support/workspace';

test.describe('AI Destekli Otomasyon Adımı Önerisi (Step Suggestion)', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TESTER');
  });

  const suggestionData = [
    { html_girdisi: "<button id='login-btn'>Giriş Yap</button>", beklenen_aksiyon: 'CLICK', beklenen_locator: '#login-btn', aciklama: 'Buton tıklaması' },
    { html_girdisi: "<input type='email' name='userEmail' />", beklenen_aksiyon: 'FILL', beklenen_locator: "input[name='userEmail']", aciklama: 'Veri girişi' },
    { html_girdisi: "<div class='alert-error'>Hatalı Şifre</div>", beklenen_aksiyon: 'ASSERT_VISIBLE', beklenen_locator: '.alert-error', aciklama: 'Hata kontrolü' },
    { html_girdisi: 'Boş veya anlamsız metin', beklenen_aksiyon: '(Boş Öneri)', beklenen_locator: '(Boş)', aciklama: 'Geçersiz HTML girdisi' },
  ];

  suggestionData.forEach((data) => {
    test(`NEXA-UI-4901 - HTML girdisine göre adım tahmini: ${data.aciklama}`, async ({ page }) => {
      await page.goto('/automation/designer/steps/new');
      
      const domInput = page.getByPlaceholder('HTML Snapshot giriniz');
      await domInput.fill(data.html_girdisi);
      
      const suggestBtn = page.getByRole('button', { name: 'Öneri Al' });
      await suggestBtn.click();

      const suggestionResult = page.locator('.ai-suggestion-result');
      
      if (data.beklenen_aksiyon !== '(Boş Öneri)') {
        await expect(suggestionResult).toContainText(data.beklenen_aksiyon);
        await expect(suggestionResult).toContainText(data.beklenen_locator);
      } else {
        await expect(suggestionResult).toContainText('Öneri bulunamadı');
      }
    });
  });

  test('NEXA-UI-4902 - Bağlam farkındalığı: Önceki adıma göre öneri', async ({ page }) => {
    await page.goto('/automation/designer/steps/new');
    
    // Mevcut adımlara bir tane ekle
    // Not: Bu kısım UI yapısına göre revize edilebilir.
    await page.locator('.current-steps-list').evaluate((el) => el.innerHTML = '<li>FILL: username_input</li>');
    
    const suggestBtn = page.getByRole('button', { name: 'Sıradaki Adımı Öner' });
    await suggestBtn.click();
    
    const suggestionList = page.locator('.ai-context-suggestions');
    await expect(suggestionList).toBeVisible();
    
    // En az bir mantıklı öneri gelmeli
    const suggestions = await suggestionList.locator('.suggestion-item').allTextContents();
    const hasLogicalSuggestion = suggestions.some(s => s.includes('password') || s.includes('submit') || s.includes('login'));
    expect(hasLogicalSuggestion).toBeTruthy();
  });

});
