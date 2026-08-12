import { expect, test } from '@playwright/test';

import { loginAs } from '../support/workspace';

test.describe('Giriş ve yetkilendirme', () => {
  test('korumalı bir sayfa anonim kullanıcıyı giriş ekranına yönlendirir', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Giriş Yap' })).toBeVisible();
    await expect(page.getByLabel('E-posta')).toBeVisible();
    await expect(page.getByLabel('Şifre')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();
  });

  test('boş veya biçimsiz form alanları anında doğrulama mesajı gösterir', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Giriş Yap' }).click();

    await expect(page.getByText('Invalid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });

  test('yanlış kimlik bilgileri oturum açmayı reddeder', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-posta').fill('yanlis.kullanici@nexa.test');
    await page.getByLabel('Şifre').fill('yanlis-parola');
    await page.getByRole('button', { name: 'Giriş Yap' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Geçersiz e-posta veya şifre')).toBeVisible();
  });

  test('geçerli kullanıcı giriş yaptığında panel açılır', async ({ page }) => {
    await loginAs(page, 'TESTER');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
  });
});
