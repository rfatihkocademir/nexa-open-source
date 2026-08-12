const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { workConfigurationService } = require(path.join(__dirname, '../../dist/services/work-configuration.service.js'));

test.describe.serial('dynamic work configuration', () => {
  let project;
  let workType;

  test.beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    project = await prisma.project.create({ data: { name: `Configuration ${suffix}`, key: `C${suffix.replace(/\D/g, '').slice(-7)}` } });
  });

  test.afterAll(async () => {
    if (project) await prisma.project.deleteMany({ where: { id: project.id } });
    await prisma.$disconnect();
  });

  test('creates a custom work type and contextual required field', async () => {
    workType = await workConfigurationService.createWorkType(project.id, {
      key: 'DATABASE_CHANGE',
      name: 'Database Change',
      baseType: 'OPERATIONAL',
    });
    await workConfigurationService.createCustomField(project.id, {
      key: 'CHANGE_TICKET',
      name: 'Change ticket',
      fieldType: 'TEXT',
      itemTypeKeys: ['DATABASE_CHANGE'],
      required: true,
      validation: { minLength: 4 },
    });

    await expect(workConfigurationService.validateWorkItemFields(project.id, 'OPERATIONAL', workType.id, {}))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(workConfigurationService.validateWorkItemFields(project.id, 'OPERATIONAL', workType.id, { CHANGE_TICKET: 'CHG-42' }))
      .resolves.toMatchObject({ CHANGE_TICKET: 'CHG-42' });
  });

  test('rejects a custom work type used with an incompatible base type', async () => {
    await expect(workConfigurationService.validateWorkItemFields(project.id, 'BUG', workType.id, { CHANGE_TICKET: 'CHG-42' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
