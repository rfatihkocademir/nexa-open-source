const path = require('node:path');
const { test, expect } = require('@playwright/test');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { userService } = require(path.join(__dirname, '../../dist/services/user.service.js'));
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

function uniqueSuffix(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupUser(userId) {
  if (!userId) return;
  await prisma.user.deleteMany({ where: { id: userId } });
}

test.describe.serial('UserService robustness hardening', () => {
  let testUser = null;

  test.beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: DEFAULT_ORGANIZATION_ID },
      update: {},
      create: { id: DEFAULT_ORGANIZATION_ID, name: 'Default test organization', slug: 'default-test-organization' },
    });
  });

  test.afterAll(async () => {
    if (testUser) {
      await cleanupUser(testUser.id);
    }
    await prisma.$disconnect();
  });

  test('UserService.create and UserService.getById should respect new DTO contracts', async () => {
    const email = `${uniqueSuffix('user-dto')}@example.com`;
    
    // Test Create
    const createData = {
      email,
      password: 'SecurePassword123!',
      firstName: 'Type',
      lastName: 'Safety',
      role: 'DEVELOPER'
    };

    const createdUser = await userService.create(createData, DEFAULT_ORGANIZATION_ID);
    testUser = createdUser;

    expect(createdUser.email).toBe(email);
    expect(createdUser.role).toBe('DEVELOPER');
    expect(createdUser.password).toBeUndefined(); // Sensitive data should be excluded from UserSummary
    expect(createdUser.id).toBeDefined();

    // Test getById
    const fetchedUser = await userService.getById(createdUser.id, DEFAULT_ORGANIZATION_ID);
    expect(fetchedUser.id).toBe(createdUser.id);
    expect(fetchedUser.firstName).toBe('Type');
    expect(fetchedUser.password).toBeUndefined();
  });

  test('UserService.update should handle partial updates safely', async () => {
    if (!testUser) return;

    const updateData = {
      firstName: 'Hardened',
      isActive: false
    };

    const updatedUser = await userService.update(testUser.id, updateData, DEFAULT_ORGANIZATION_ID);
    
    expect(updatedUser.id).toBe(testUser.id);
    expect(updatedUser.firstName).toBe('Hardened');
    expect(updatedUser.lastName).toBe(testUser.lastName); // Unchanged
    expect(updatedUser.isActive).toBe(false);
  });

  test('UserService.getAllUsers should return an array of UserSummary', async () => {
    const users = await userService.getAllUsers(DEFAULT_ORGANIZATION_ID);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    
    const found = users.find(u => u.id === testUser.id);
    expect(found).toBeDefined();
    expect(found.password).toBeUndefined();
  });
});
