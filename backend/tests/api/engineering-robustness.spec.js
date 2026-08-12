const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { getTestRuntime } = require('./helpers/test-runtime');

const prisma = require(path.join(__dirname, '../../dist/utils/prisma.js')).default;
const { knowledgeService } = require(path.join(__dirname, '../../dist/services/knowledge.service.js'));
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

function uniqueSuffix(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupProject(projectId) {
  if (!projectId) return;
  await prisma.project.deleteMany({ where: { id: projectId } });
}

async function cleanupUser(userId) {
  if (!userId) return;
  await prisma.user.deleteMany({ where: { id: userId } });
}

test.describe.serial('engineering robustness hardening', () => {
  let runtime = null;

  test.afterAll(async () => {
    if (runtime) {
      await runtime.close();
      return;
    }

    await prisma.$disconnect();
  });

  test('syncProjectKnowledge only indexes approved wiki pages and prunes stale wiki vectors', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${uniqueSuffix('knowledge-user')}@example.com`,
        password: 'hashed-password',
        firstName: 'Knowledge',
        lastName: 'Tester',
        role: 'TESTER',
      },
    });

    const project = await prisma.project.create({
      data: {
        name: uniqueSuffix('knowledge-project'),
        key: uniqueSuffix('KNOWLEDGE').toUpperCase(),
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });

    const space = await prisma.wikiSpace.create({
      data: {
        projectId: project.id,
        name: uniqueSuffix('knowledge-space'),
      },
    });

    const approvedPage = await prisma.wikiPage.create({
      data: {
        title: 'Approved Architecture',
        content: '<p>Approved system design with enough detail to be indexed.</p>',
        status: 'APPROVED',
        spaceId: space.id,
        authorId: user.id,
      },
    });

    await prisma.wikiPage.create({
      data: {
        title: 'Draft Notes',
        content: '<p>Draft implementation note that must stay out of project memory.</p>',
        status: 'DRAFT',
        spaceId: space.id,
        authorId: user.id,
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
      },
    });

    const deleteCalls = [];
    const indexCalls = [];
    const originalDeleteMany = prisma.projectKnowledge.deleteMany;
    const originalIndexEntity = knowledgeService.indexEntity;

    prisma.projectKnowledge.deleteMany = async (args) => {
      deleteCalls.push(args);
      return { count: 0 };
    };

    knowledgeService.indexEntity = async (projectId, entityType, entityId, content) => {
      indexCalls.push({ projectId, entityType, entityId, content });
    };

    try {
      await knowledgeService.syncProjectKnowledge(project.id, user.id, user.role);
    } finally {
      prisma.projectKnowledge.deleteMany = originalDeleteMany;
      knowledgeService.indexEntity = originalIndexEntity;
      await cleanupProject(project.id);
      await cleanupUser(user.id);
    }

    const wikiDeleteCall = deleteCalls.find((call) => call?.where?.entityType === 'WikiPage');
    const wikiIndexCalls = indexCalls.filter((call) => call.entityType === 'WikiPage');

    expect(wikiDeleteCall).toBeTruthy();
    expect(wikiDeleteCall.where.projectId).toBe(project.id);
    expect(wikiDeleteCall.where.entityId.notIn).toEqual([approvedPage.id]);
    expect(wikiIndexCalls).toHaveLength(1);
    expect(wikiIndexCalls[0].projectId).toBe(project.id);
    expect(wikiIndexCalls[0].entityId).toBe(approvedPage.id);
    expect(wikiIndexCalls[0].content).toContain('Approved Architecture');
    expect(wikiIndexCalls[0].content).not.toContain('Draft Notes');
  });

  test('project-scoped AI and automation routes reject missing or foreign project context', async () => {
    runtime = await getTestRuntime();

    const tester = await runtime.upsertUser({
      email: `${uniqueSuffix('tester')}@example.com`,
      password: 'Password123!',
      role: 'TESTER',
      firstName: 'Scope',
      lastName: 'Tester',
    });

    const leader = await runtime.upsertUser({
      email: `${uniqueSuffix('leader')}@example.com`,
      password: 'Password123!',
      role: 'TEAM_LEADER',
      firstName: 'Scope',
      lastName: 'Leader',
    });

    const outsider = await runtime.upsertUser({
      email: `${uniqueSuffix('outsider')}@example.com`,
      password: 'Password123!',
      role: 'TESTER',
      firstName: 'Outsider',
      lastName: 'Tester',
    });

    const ownedProject = await runtime.prisma.project.create({
      data: {
        name: uniqueSuffix('owned-project'),
        key: uniqueSuffix('OWNED').toUpperCase(),
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });

    const foreignProject = await runtime.prisma.project.create({
      data: {
        name: uniqueSuffix('foreign-project'),
        key: uniqueSuffix('FOREIGN').toUpperCase(),
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });

    await runtime.prisma.projectMember.createMany({
      data: [
        { projectId: ownedProject.id, userId: tester.id },
        { projectId: ownedProject.id, userId: leader.id },
      ],
    });

    const testerToken = runtime.signToken(tester);
    const leaderToken = runtime.signToken(leader);
    const outsiderToken = runtime.signToken(outsider);
    const dryRunPayload = {
      projectId: ownedProject.id,
      steps: [
        {
          projectId: ownedProject.id,
          name: 'Open login page',
          actionType: 'NAVIGATE',
          locator: 'https://example.com/login',
          data: 'https://example.com/login',
        },
      ],
      variables: {},
      headless: true,
    };

    try {
      const missingSuggestProject = await runtime.request('POST', '/api/v1/automation/steps/suggest', {
        token: testerToken,
        json: {
          html: '<button id="login-button">Login</button>',
        },
      });
      expect(missingSuggestProject.status).toBe(400);

      const suggestOk = await runtime.request('POST', '/api/v1/automation/steps/suggest', {
        token: testerToken,
        json: {
          projectId: ownedProject.id,
          html: '<button id="login-button">Login</button>',
        },
      });
      expect(suggestOk.status).toBe(200);
      expect(suggestOk.body.data[0].locator).toContain('login-button');

      const dryRunOk = await runtime.request('POST', '/api/v1/automation/scenarios/dry-run', {
        token: testerToken,
        json: dryRunPayload,
      });
      expect(dryRunOk.status).toBe(200);
      expect(dryRunOk.body.data.status).toBe('PASS');

      const dryRunStart = await runtime.request('POST', '/api/v1/automation/scenarios/dry-run/start', {
        token: testerToken,
        json: { projectId: ownedProject.id, steps: [], variables: {}, headless: true },
      });
      expect(dryRunStart.status).toBe(202);
      const dryRunId = dryRunStart.body.data.dryRunId;
      const dryRunForeignStatus = await runtime.request('GET', `/api/v1/automation/scenarios/dry-run/${dryRunId}`, {
        token: outsiderToken,
      });
      expect(dryRunForeignStatus.status).toBe(403);
      const dryRunForeignDelete = await runtime.request('DELETE', `/api/v1/automation/scenarios/dry-run/${dryRunId}`, {
        token: outsiderToken,
      });
      expect(dryRunForeignDelete.status).toBe(403);
      const dryRunOwnerDelete = await runtime.request('DELETE', `/api/v1/automation/scenarios/dry-run/${dryRunId}`, {
        token: testerToken,
      });
      expect(dryRunOwnerDelete.status).toBe(200);

      const apiProxyMissingProject = await runtime.request('POST', '/api/v1/api-automation/execute-step', {
        token: testerToken,
        json: { url: 'http://127.0.0.1/admin', method: 'GET' },
      });
      expect(apiProxyMissingProject.status).toBe(400);
      const apiProxyForeignProject = await runtime.request('POST', '/api/v1/api-automation/execute-step', {
        token: testerToken,
        json: { projectId: foreignProject.id, url: 'http://127.0.0.1/admin', method: 'GET' },
      });
      expect(apiProxyForeignProject.status).toBe(403);
      const apiProxyPrivateTarget = await runtime.request('POST', '/api/v1/api-automation/execute-step', {
        token: testerToken,
        json: { projectId: ownedProject.id, url: 'http://127.0.0.1/admin', method: 'GET' },
      });
      expect(apiProxyPrivateTarget.status).toBe(403);

      const dryRunForbidden = await runtime.request('POST', '/api/v1/automation/scenarios/dry-run', {
        token: testerToken,
        json: {
          ...dryRunPayload,
          projectId: foreignProject.id,
          steps: dryRunPayload.steps.map((step) => ({ ...step, projectId: foreignProject.id })),
        },
      });
      expect(dryRunForbidden.status).toBe(403);

      const cleanupMissingProject = await runtime.request('POST', '/api/v1/automation/scenarios/cleanup-video', {
        token: testerToken,
        json: {
          videoUrl: '/public/videos/video-dry-123.webm',
        },
      });
      expect(cleanupMissingProject.status).toBe(400);

      const cleanupOk = await runtime.request('POST', '/api/v1/automation/scenarios/cleanup-video', {
        token: testerToken,
        json: {
          projectId: ownedProject.id,
          videoUrl: '/public/videos/video-dry-123.webm',
        },
      });
      expect(cleanupOk.status).toBe(200);

      const generateStepsMissingProject = await runtime.request('POST', '/api/v1/ai/generate-steps', {
        token: testerToken,
        json: {
          title: 'Login flow',
        },
      });
      expect(generateStepsMissingProject.status).toBe(400);

      const generateStepsOk = await runtime.request('POST', '/api/v1/ai/generate-steps', {
        token: testerToken,
        json: {
          projectId: ownedProject.id,
          title: 'Login flow',
          language: 'en',
        },
      });
      expect(generateStepsOk.status).toBe(200);
      expect(generateStepsOk.body.data.steps).toHaveLength(2);

      const generateStepsForbidden = await runtime.request('POST', '/api/v1/ai/generate-steps', {
        token: testerToken,
        json: {
          projectId: foreignProject.id,
          title: 'Foreign flow',
          language: 'en',
        },
      });
      expect(generateStepsForbidden.status).toBe(403);

      const generateStoriesOk = await runtime.request('POST', '/api/v1/ai/generate-stories', {
        token: leaderToken,
        json: {
          projectId: ownedProject.id,
          description: 'Generate backlog for login',
          language: 'en',
        },
      });
      expect(generateStoriesOk.status).toBe(200);
      expect(generateStoriesOk.body.data.stories).toHaveLength(1);

      const generateStoriesForbidden = await runtime.request('POST', '/api/v1/ai/generate-stories', {
        token: leaderToken,
        json: {
          projectId: foreignProject.id,
          description: 'Foreign project backlog',
          language: 'en',
        },
      });
      expect(generateStoriesForbidden.status).toBe(403);

      const jiraMigrationForbidden = await runtime.request('POST', '/api/v1/jira-migration/import-api', {
        token: testerToken,
        json: {
          projectId: foreignProject.id,
          hostUrl: 'https://example.atlassian.net',
          email: 'user@example.com',
          apiToken: 'token',
          jiraProjectKey: 'FOREIGN',
        },
      });
      expect(jiraMigrationForbidden.status).toBe(403);

      const jiraMigrationMissingScope = await runtime.request('POST', '/api/v1/jira-migration/import-json', {
        token: testerToken,
        json: { issues: [] },
      });
      expect(jiraMigrationMissingScope.status).toBe(400);
    } finally {
      await runtime.prisma.$transaction([
        runtime.prisma.auditLog.deleteMany({
          where: {
            projectId: { in: [ownedProject.id, foreignProject.id] },
          },
        }),
        runtime.prisma.project.deleteMany({
          where: {
            id: { in: [ownedProject.id, foreignProject.id] },
          },
        }),
      ]);
      await runtime.prisma.user.deleteMany({
        where: {
          id: { in: [tester.id, leader.id] },
        },
      });
      await runtime.prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
