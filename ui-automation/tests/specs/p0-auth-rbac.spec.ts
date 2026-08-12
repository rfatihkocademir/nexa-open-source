import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('P0 kimlik ve yetkilendirme senaryoları', () => {
  test.skip(isLiveMode, 'P0 RBAC kapsamı mock kullanıcı rolleri ve çalışma alanı verisi gerektiriyor.');

  test('anonim kullanıcı derin proje linkinden giriş ekranına yönlendirilir', async ({ page }) => {
    await page.goto('/projects/project-sales?tab=test-cases');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Giriş Yap' })).toBeVisible();
  });

  test('oturum açıkken giriş sayfasına dönmek dashboard yönlendirmesi yapar', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');

    await page.goto('/login');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
  });

  test('tester global menüde yönetim alanını görmez', async ({ page }) => {
    await loginAs(page, 'TESTER');

    await expect(page.getByRole('button', { name: 'Yönetim' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Çalışma Alanı' })).toBeVisible();
  });

  test('tester admin adresine doğrudan giderse 403 alır', async ({ page }) => {
    await loginAs(page, 'TESTER');
    await page.goto('/admin/users');

    await expect(page).toHaveURL(/\/403$/);
    await expect(page.getByRole('heading', { name: '403 Erişim Engellendi' })).toBeVisible();
  });

  test('admin kullanıcı yönetimi ekranında sistem rollerini ve kullanıcıları görür', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: 'Kullanıcı Yönetimi' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Aylin', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ayşe', exact: true })).toBeVisible();
    await expect(page.getByText('ADMIN')).toBeVisible();
    await expect(page.getByText('TEAM_LEADER')).toBeVisible();
  });

  test('admin kullanıcı oluşturma formu zorunlu alan doğrulaması yapar', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/users');

    await page.getByRole('button', { name: 'Oluştur' }).click();
    await expect(page.getByRole('dialog', { name: 'Kullanıcı Ekle' })).toBeVisible();
    await page.getByRole('button', { name: 'Kullanıcı Oluştur' }).click();

    await expect(page.getByText('Geçersiz e-posta adresi')).toBeVisible();
    await expect(page.getByText('Ad gereklidir', { exact: true })).toBeVisible();
    await expect(page.getByText('Soyad gereklidir', { exact: true })).toBeVisible();
  });

  test('admin yeni tester hesabı oluşturup listede arayabilir', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/users');

    await page.getByRole('button', { name: 'Oluştur' }).click();
    await page.getByLabel('Ad', { exact: true }).fill('Nil');
    await page.getByLabel('Soyad', { exact: true }).fill('Ergin');
    await page.getByLabel('E-posta').fill('nil.ergin@nexa.test');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.getByRole('button', { name: 'Kullanıcı Oluştur' }).click();

    await expect(page.getByRole('dialog', { name: 'Kullanıcı Ekle' })).not.toBeVisible();
    await page.getByPlaceholder('Ara').fill('nil.ergin');
    await expect(page.getByRole('cell', { name: 'Nil', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'nil.ergin@nexa.test' })).toBeVisible();
  });

  test('çıkış işlemi oturumu temizler ve korumalı sayfayı tekrar login ekranına alır', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');

    await page.locator('header').getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Çıkış Yap' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
