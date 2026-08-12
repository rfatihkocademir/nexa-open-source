import { expect, type Page } from '@playwright/test';

import type { LiveCredentials } from './live-user';

export async function signInThroughUi(page: Page, credentials: LiveCredentials) {
  await page.goto('/login');
  await page.getByLabel('E-posta', { exact: true }).fill(credentials.email);
  await page.getByLabel('Şifre', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 20_000 });
  const onboardingDialog = page.getByRole('dialog', { name: /Nexa Yardım Merkezi|Nexa Help Center/ });
  if (await onboardingDialog.isVisible().catch(() => false)) {
    await onboardingDialog.getByRole('button', { name: /Kapat|Close/i }).click();
  }
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
}

export async function openCreateProjectWizard(page: Page) {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Proje Portföy Yönetimi' })).toBeVisible();
  await page.getByRole('button', { name: 'Proje Oluştur' }).click();
  await expect(page.getByRole('heading', { name: 'Proje Kurulumu' })).toBeVisible();
}
