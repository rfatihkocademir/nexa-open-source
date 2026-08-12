import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

import { signInThroughUi } from '../support/ui';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const bcrypt = require('../../../backend/node_modules/bcryptjs');
const prisma = new PrismaClient();

test.describe.serial('Kapalı sprint geçmişi', () => {
  let userId = '';
  let projectId = '';
  let projectKey = '';
  const password = 'SprintHistory123!';
  const email = `sprint-history-${Date.now()}@nexa.test`;

  test.beforeAll(async () => {
    const organization = await prisma.organization.findFirst({ select: { id: true } });
    projectKey = `SH${String(Date.now()).slice(-6)}`;
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        firstName: 'Sprint',
        lastName: 'Geçmişi',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        organizationMemberships: organization
          ? { create: { organizationId: organization.id, isOwner: true } }
          : undefined,
      },
    });
    userId = user.id;

    const project = await prisma.project.create({
      data: {
        name: 'Sprint Geçmişi E2E',
        key: projectKey,
        organizationId: organization?.id,
        members: { create: { userId, weeklyCapacityMinutes: 2400 } },
        sprints: {
          create: [
            {
              name: 'Kapanmış Sprint Alfa',
              status: 'CLOSED',
              goal: 'Alfa hedefi',
              capacityPoints: 8,
              startDate: new Date('2026-06-01T00:00:00Z'),
              endDate: new Date('2026-06-14T00:00:00Z'),
            },
            {
              name: 'Kapanmış Sprint Beta',
              status: 'CLOSED',
              goal: 'Beta hedefi',
              capacityPoints: 13,
              startDate: new Date('2026-06-15T00:00:00Z'),
              endDate: new Date('2026-06-28T00:00:00Z'),
            },
            {
              name: 'Aktif Sprint',
              status: 'ACTIVE',
              goal: 'Görünüm doğrulama',
              capacityPoints: 13,
              startDate: new Date('2026-07-20T00:00:00Z'),
              endDate: new Date('2026-08-02T00:00:00Z'),
            },
          ],
        },
        boardColumns: {
          create: [
            { name: 'Yapılacak', orderIndex: 0, mappedStatus: 'TODO', isDefault: true, allowedTransitions: [] },
            { name: 'Devam Ediyor', orderIndex: 1, mappedStatus: 'IN_PROGRESS', isDefault: true, allowedTransitions: [] },
            { name: 'Tamamlandı', orderIndex: 2, mappedStatus: 'DONE', isDefault: true, allowedTransitions: [] },
          ],
        },
      },
    });
    projectId = project.id;

    await prisma.requirement.create({
      data: {
        projectId,
        authorId: userId,
        title: 'Sprint planlama gereksinimi',
        type: 'FUNCTIONAL',
        status: 'APPROVED',
      },
    });

    await prisma.sprint.createMany({
      data: Array.from({ length: 8 }, (_, index) => ({
        projectId,
        name: `Kapanmış Sprint ${index + 3}`,
        status: 'CLOSED',
        capacityPoints: 10,
        startDate: new Date(Date.UTC(2026, index, 1)),
        endDate: new Date(Date.UTC(2026, index, 14)),
      })),
    });

    await prisma.workItem.createMany({
      data: Array.from({ length: 24 }, (_, index) => ({
        key: `${projectKey}-${index + 1}`,
        sequenceNumber: index + 1,
        projectId,
        itemType: 'STORY',
        title: `Kaydırma doğrulama işi ${index + 1}`,
        status: 'BACKLOG',
        boardOrder: index,
      })),
    });
    await prisma.workItem.create({
      data: {
        key: `${projectKey}-25`,
        sequenceNumber: 25,
        projectId,
        itemType: 'BUG',
        title: 'Kritik ödeme regresyon hatası',
        status: 'OPEN',
        priority: 'CRITICAL',
        severity: 'CRITICAL',
      },
    });
  });

  test.afterAll(async () => {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('Backlog ve Planlama Modu kapalı sprintleri salt okunur gösterir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const protectedRequestFailures: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 401 && response.url().includes('/api/v1/')) protectedRequestFailures.push(response.url());
    });
    await signInThroughUi(page, {
      email,
      password,
      firstName: 'Sprint',
      lastName: 'Geçmişi',
    });

    await page.goto(`/p/${projectKey}/backlog`);
    await expect(page).toHaveURL(new RegExp(`/p/${projectKey}/backlog`));
    await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Backlog', exact: true }).first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: /Sprint geçmişi/ })).toContainText('10');
    await expect(page.getByText('Kapanmış Sprint Alfa', { exact: true })).toBeVisible();
    await expect(page.getByText('Kapanmış Sprint Beta', { exact: true })).toBeVisible();

    const backlogScroll = page.getByTestId('backlog-scroll-region');
    const sprintScroll = page.getByTestId('sprint-scroll-region');
    await expect(backlogScroll).toBeVisible();
    await expect(sprintScroll).toBeVisible();
    await expect.poll(() => backlogScroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect.poll(() => sprintScroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    await sprintScroll.evaluate((element) => { element.scrollTop = 0; });
    await backlogScroll.evaluate((element) => { element.scrollTop = 180; });
    await expect.poll(() => backlogScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => sprintScroll.evaluate((element) => element.scrollTop)).toBe(0);

    await sprintScroll.evaluate((element) => { element.scrollTop = 180; });
    await expect.poll(() => sprintScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Planlama Modu/ }).click();
    const planningDialog = page.getByRole('dialog');
    await expect(planningDialog).toBeVisible();
    await planningDialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Kapanmış Sprint Alfa · Kapalı/ }).click();
    await expect(page.getByText('Geçmiş sprint incelemesi')).toBeVisible();
    await expect(page.getByText(/salt okunur gösterilir/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Oturum oluştur' })).toHaveCount(0);

    await planningDialog.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: /Kapanmış Sprint Alfa · Kapalı/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Kapanmış Sprint Beta · Kapalı/ })).toBeVisible();
    expect(protectedRequestFailures).toEqual([]);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Sprintler', exact: true }).click();
    await expect(page.getByTestId('sprint-scroll-region')).toBeVisible();
  });

  test('Eski proje URL’si canonical adrese döner ve geçersiz bölüm 404 gösterir', async ({ page }) => {
    await signInThroughUi(page, {
      email,
      password,
      firstName: 'Sprint',
      lastName: 'Geçmişi',
    });

    await page.goto(`/projects/${projectId}?tab=runs&aiFocus=open-runs`);
    await expect(page).toHaveURL(new RegExp(`/p/${projectKey}/runs\\?aiFocus=open-runs$`));
    await expect(page.getByRole('link', { name: /Test Koşuları|Test Runs/i }).first()).toHaveAttribute('aria-current', 'page');

    await page.goto(`/p/${projectKey}/gecersiz-bolum`);
    await expect(page.getByRole('heading', { name: /Aradığınız sayfa bulunamadı/i })).toBeVisible();
  });

  test('Oturum açıldıktan sonra istenen derin bağlantıya geri döner', async ({ page }) => {
    await page.goto(`/p/${projectKey}/backlog?aiFocus=critical-bugs`);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('E-posta', { exact: true }).fill(email);
    await page.getByLabel('Şifre', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Giriş Yap' }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${projectKey}/backlog\\?aiFocus=critical-bugs$`));
    const onboardingDialog = page.getByRole('dialog', { name: /Nexa Yardım Merkezi|Nexa Help Center/ });
    if (await onboardingDialog.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      await onboardingDialog.getByRole('button', { name: /Kapat|Close/i }).click();
    }
    await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
  });

  test('Hızlı oluşturma, global work item araması ve paylaşılabilir liste görünümü çalışır', async ({ page }) => {
    await signInThroughUi(page, {
      email,
      password,
      firstName: 'Sprint',
      lastName: 'Geçmişi',
    });

    await page.goto(`/p/${projectKey}/backlog`);
    await page.getByLabel('Oluştur', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Geliştirme işi' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Geliştirme işi' });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Başlık').fill('Hızlı oluşturma doğrulama işi');
    await expect(createDialog.getByText(/Taslak .* kaydedildi/)).toBeVisible();
    await createDialog.getByRole('button', { name: 'İptal' }).click();
    await expect(createDialog).toBeHidden();
    await page.getByLabel('Oluştur', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Geliştirme işi' }).click();
    await expect(createDialog.getByLabel('Başlık')).toHaveValue('Hızlı oluşturma doğrulama işi');
    const createResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/tasks') && response.request().method() === 'POST'
    );
    await createDialog.getByRole('button', { name: 'Oluştur', exact: true }).click();
    const taskResponse = await createResponse;
    expect(taskResponse.status(), await taskResponse.text()).toBe(201);
    await expect(page.getByText('İş oluşturuldu')).toBeVisible();
    await expect(createDialog).toBeHidden();

    await page.keyboard.press('Control+k');
    const commandDialog = page.getByRole('dialog', { name: 'Global Komut Menüsü' });
    await expect(commandDialog).toBeVisible();
    await commandDialog.getByPlaceholder('Bir komut yazın veya arayın...').fill('Hızlı oluşturma doğrulama');
    await expect(commandDialog.getByText('Hızlı oluşturma doğrulama işi')).toBeVisible();
    await commandDialog.getByText('Hızlı oluşturma doğrulama işi').click();
    await expect(page).toHaveURL(new RegExp(`/b/${projectKey}-\\d+$`));

    await page.goto('/projects?q=Sprint&view=grid');
    await expect(page.getByPlaceholder('Projeleri filtrele...')).toHaveValue('Sprint');
    await expect(page).toHaveURL(/q=Sprint/);
    await expect(page).toHaveURL(/view=grid/);
  });

  test('Board görünümü sunucuda kaydedilir ve sayfa yenilendiğinde korunur', async ({ page }) => {
    await signInThroughUi(page, {
      email,
      password,
      firstName: 'Sprint',
      lastName: 'Geçmişi',
    });

    await page.goto(`/p/${projectKey}/board?priority=HIGH`);
    await expect(page.getByRole('heading', { name: 'Agile Board' })).toBeVisible();
    await page.getByRole('button', { name: 'Görünümler' }).click();
    await page.getByRole('menuitem', { name: 'Mevcut filtreleri kaydet' }).click();
    const saveDialog = page.getByRole('dialog', { name: 'Görünümü kaydet' });
    await saveDialog.getByLabel('Görünüm adı').fill('Yüksek öncelikli işler');
    const saveResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/saved-views') && response.request().method() === 'POST'
    );
    await saveDialog.getByRole('button', { name: 'Kaydet' }).click();
    expect((await saveResponse).status()).toBe(201);
    await expect(page.getByText('Görünüm kaydedildi')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Görünümler' }).click();
    await expect(page.getByRole('menuitem', { name: /Yüksek öncelikli işler/ })).toBeVisible();
  });

  test('NQL filtresi paylaşılabilir URL üretir ve kişisel filtre olarak kaydedilir', async ({ page }) => {
    await signInThroughUi(page, {
      email,
      password,
      firstName: 'Sprint',
      lastName: 'Geçmişi',
    });
    await page.goto(`/p/${projectKey}/backlog`);
    await page.getByRole('button', { name: /Gelişmiş filtreler/ }).click();
    const nqlInput = page.getByPlaceholder(/type = BUG AND priority/);
    const searchResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/work-items/search/nql') && response.status() === 200
    );
    await nqlInput.fill('type = BUG AND priority = CRITICAL ORDER BY updated DESC');
    await searchResponse;
    await expect(page).toHaveURL(/nql=type/);
    await expect(page.getByText('Kritik ödeme regresyon hatası')).toBeVisible();
    await expect(page.getByText('Kaydırma doğrulama işi 1')).toHaveCount(0);

    await page.getByRole('button', { name: 'Filtreyi kaydet' }).click();
    const promptDialog = page.getByRole('dialog', { name: 'Filtreyi kaydet' });
    await promptDialog.getByRole('textbox').fill('Kritik regresyon hataları');
    const saveResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/saved-views') && response.request().method() === 'POST'
    );
    await promptDialog.getByRole('button', { name: 'Kaydet' }).click();
    expect((await saveResponse).status()).toBe(201);
    await page.getByRole('button', { name: /Kayıtlı filtreler/ }).click();
    await expect(page.getByRole('menuitem', { name: /Kritik regresyon hataları/ })).toBeVisible();
  });
});
