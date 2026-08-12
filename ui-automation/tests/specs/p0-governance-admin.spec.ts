import { expect, test } from '@playwright/test';

import { isLiveMode } from '../support/env';
import { loginAs } from '../support/workspace';

test.describe('P0 governance, wiki, release ve admin senaryoları', () => {
  test.skip(isLiveMode, 'P0 governance kapsamı mock milestone, wiki, release ve admin verisi gerektiriyor.');

  test('kilometre taşı listesi arama ile sprint detayına gider', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/milestones');

    await page.getByPlaceholder('Kilometre taşlarını filtrele...').fill('Sprint 24');
    await expect(page.getByRole('link', { name: 'Sprint 24', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Sprint 24', exact: true }).click();

    await expect(page).toHaveURL(/\/milestones\/milestone-sprint-24$/);
    await expect(page.getByText('Ödeme ve giriş akışlarını stabilize etme hedefi.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bağlı Test Koşuları' })).toBeVisible();
  });

  test('wiki ana sayfası ve alt çalışma rehberi okunabilir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=wiki');

    await expect(page.getByRole('heading', { name: 'Satış Portalı Wiki' }).first()).toBeVisible();
    await expect(page.getByText('Proje kapsamı ve kalite kapıları.')).toBeVisible();

    await page.getByText('Test Çalışma Rehberi', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Test Çalışma Rehberi' }).first()).toBeVisible();
    await expect(page.getByText('Regresyon koşusu')).toBeVisible();
  });

  test('wiki sayfası düzenleme modunda başlık ve içerik kaydedebilir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=wiki');

    await page.getByRole('button', { name: 'Düzenle' }).click();
    await page.getByPlaceholder('Sayfa Başlığı').fill('Satış Portalı Wiki - Güncel');
    await page.locator('.ProseMirror').fill('Güncellenen kalite kapısı notu.');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.getByRole('heading', { name: 'Satış Portalı Wiki - Güncel' })).toBeVisible();
    await expect(page.getByText('Güncellenen kalite kapısı notu.')).toBeVisible();
  });

  test('release hub takip öğesi odağında release adayını ve risk metriklerini gösterir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales?tab=releases&aiFocus=follow-up-items');

    await expect(page.getByText('AI odağı: açık takip öğesi olan release\'ler')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Release governance' })).toBeVisible();
    await expect(page.getByText('Sprint 24 Release Candidate')).toBeVisible();
    await expect(page.getByText('Açık hatalar')).toBeVisible();
    await expect(page.getByText('Kritik: 1')).toBeVisible();
  });

  test('release candidate detayı AI özeti, kontrol listesi ve takip öğelerini gösterir', async ({ page }) => {
    await loginAs(page, 'TEAM_LEADER');
    await page.goto('/projects/project-sales/releases/release-sprint-24');

    await expect(page.getByRole('heading', { name: 'Sprint 24 Release Candidate' })).toBeVisible();
    await expect(page.getByText('Release kontrol listesi')).toBeVisible();
    await expect(page.getByText('AI release özeti')).toBeVisible();
    await expect(page.getByText('Kritik ödeme hatası halen açık.')).toBeVisible();
    await expect(page.getByText('Ödeme onayı zaman aşımı', { exact: true })).toBeVisible();
  });

  test('admin kullanıcı araması sonuçsuz ve sonuçlu durumları ayırır', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/users');

    const search = page.getByPlaceholder('Ara');
    await search.fill('kimse-yok');
    await expect(page.getByRole('heading', { name: 'Kullanıcı bulunamadı' })).toBeVisible();

    await search.fill('deniz');
    await expect(page.getByRole('cell', { name: 'Deniz', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'deniz.kaya@nexa.test' })).toBeVisible();
  });
});
