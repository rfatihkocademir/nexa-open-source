const http = require('node:http');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let runtimePromise = null;
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

function dist(modulePath) {
  return path.join(process.cwd(), 'dist', modulePath);
}

function patchExternalDependencies() {
  const backgroundTask = require(dist('utils/backgroundTask.js'));
  backgroundTask.runInBackground = () => Promise.resolve();

  const promptServiceModule = require(dist('services/prompt.service.js'));
  promptServiceModule.promptService.renderPrompt = async (slug, variables = {}) =>
    `slug:${slug}\n${JSON.stringify(variables)}`;

  const aiProviderModule = require(dist('services/aiProvider.service.js'));
  aiProviderModule.generateAIText = async (prompt) => `stubbed:${prompt}`;
  aiProviderModule.generateAIEmbedding = async () => Array.from({ length: 8 }, () => 0.01);
  aiProviderModule.generateAIJson = async (prompt) => {
    if (prompt.includes('slug:business-request-analyzer') || prompt.includes('slug:mvp-backlog-completion')) {
      return {
        status: 'COMPLETE',
        epics: [
          {
            title: 'Identity Epic',
            description: 'Authentication and authorization',
            reasoning: 'Core product flow',
            stories: [
              {
                title: 'User signs in',
                description: 'As a user I can sign in',
                acceptanceCriteria: 'Valid users can sign in',
                points: 3,
                priority: 'HIGH',
              },
            ],
          },
        ],
      };
    }

    if (prompt.includes('slug:release-risk-analyzer')) {
      return {
        riskScore: 12,
        assessment: 'Low release risk in test harness',
        recommendation: 'GO',
      };
    }

    if (prompt.includes('HTML:')) {
      return [
        {
          name: 'Click Login',
          locator: '#login-button',
          actionType: 'CLICK',
          description: 'Click login button',
          confidence: 0.99,
        },
      ];
    }

    return {};
  };

  const knowledgeServiceModule = require(dist('services/knowledge.service.js'));
  knowledgeServiceModule.knowledgeService.indexEntity = async () => undefined;
  knowledgeServiceModule.knowledgeService.syncProjectKnowledge = async () => undefined;
  knowledgeServiceModule.knowledgeService.vectorSearch = async () => [];
  knowledgeServiceModule.knowledgeService.getProjectKnowledgeCount = async () => 0;

  const aiServiceModule = require(dist('services/ai.service.js'));
  aiServiceModule.aiAnalystService.generateStoriesSynchronous = async (description) => [
    { title: `Story for ${description}`, description: 'AI generated story', acceptanceCriteria: 'Works' },
  ];
  aiServiceModule.aiAnalystService.generateManualSteps = async (title) => [
    { action: `Open ${title}`, expected: 'Page is visible' },
    { action: 'Submit form', expected: 'Success message is visible' },
  ];
  aiServiceModule.aiAnalystService.extractElementsFromHtml = async () => [
    { name: 'Login button', locator: '#login-button', type: 'button' },
  ];

  const projectServiceModule = require(dist('services/project.service.js'));
  projectServiceModule.projectService.generateQuestions = async () => ({
    questions: ['What roles should be supported?', 'What is the release cadence?'],
  });
  projectServiceModule.projectService.generateScope = async () => ({
    scope: 'Stubbed scope',
    architecture: 'Stubbed architecture',
  });
  projectServiceModule.projectService.generateConsolidatedWiki = async () => ({
    content: '<h1>Stubbed wiki</h1>',
  });

  const assistantModule = require(dist('services/project-assistant.service.js'));
  assistantModule.projectAssistantService.chat = async (_projectId, _userId, _role, messages) => ({
    answer: `Stubbed assistant answer for ${messages.length} message(s)`,
    sources: [],
  });

  const autoBugModule = require(dist('services/autoBugReporter.service.js'));
  autoBugModule.AutoBugReporterService.analyzeFailure = async (_userId, _role, testResultId) => ({
    testResultId,
    summary: 'Stubbed failure analysis',
    suggestedBug: {
      title: 'Generated failure bug',
      description: 'Created by API test harness',
    },
  });

  const exportModule = require(dist('services/export.service.js'));
  exportModule.exportService.exportTestCases = async () => Buffer.from('xlsx:test-cases');
  exportModule.exportService.exportTestRunResults = async () => Buffer.from('xlsx:test-run-results');
  exportModule.exportService.exportComparisonReport = async () => Buffer.from('%PDF-1.4 stub');

  const aiQueueModule = require(dist('services/queue/ai.queue.js'));
  aiQueueModule.aiQueue.add = async (_name, data) => ({
    id: `ai-job-${Date.now()}`,
    name: data.type,
    attemptsMade: 0,
  });

  const automationQueueModule = require(dist('services/queue/automation.queue.js'));
  automationQueueModule.automationQueue.add = async (_name, data) => ({
    id: `automation-job-${Date.now()}`,
    name: data.type || 'automation',
    attemptsMade: 0,
  });

  const bugQueueModule = require(dist('services/queue/bug-reporting.queue.js'));
  bugQueueModule.bugReportingQueue.add = async (_name, data) => ({
    id: `bug-job-${Date.now()}`,
    name: data.type || 'bug-reporting',
    attemptsMade: 0,
  });

  const minioModule = require(dist('services/minio.service.js'));
  minioModule.ensureBucket = async () => undefined;
  minioModule.uploadFile = async (objectKey) => objectKey;
  minioModule.uploadFileFromPath = async (objectKey) => objectKey;
  minioModule.getPresignedUrl = async (objectKey) => `https://stub-storage.local/${encodeURIComponent(objectKey)}`;
  minioModule.deleteFile = async () => undefined;
  minioModule.deleteFiles = async () => undefined;
  minioModule.getFileStat = async () => ({ size: 12 });

  const playwrightModule = require(dist('services/playwrightExecutor.service.js'));
  playwrightModule.playwrightExecutorService.execute = async () => ({
    status: 'PASS',
    duration: 42,
    logs: 'stubbed playwright execution',
    steps: [{ name: 'step-1', status: 'passed', duration: 42 }],
    videoUrl: '/public/videos/stubbed.webm',
  });
}

async function createRuntime() {
  patchExternalDependencies();
  const { initCommandBus } = require(dist('core/bus/init.js'));
  initCommandBus();

  const prisma = require(dist('utils/prisma.js')).default;
  const app = require(dist('app.js')).default;

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let closed = false;

  async function request(method, urlPath, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body;

    if (options.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      body = options.body;
    }

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body,
      redirect: options.redirect || 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    let payload;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = Buffer.from(await response.arrayBuffer());
    }

    return {
      status: response.status,
      headers: response.headers,
      body: payload,
      raw: response,
    };
  }

  async function upsertUser({
    email,
    password,
    role = 'TESTER',
    firstName = 'API',
    lastName = 'User',
    isActive = true,
  }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role,
        firstName,
        lastName,
        isActive,
        deletedAt: null,
      },
      create: {
        email,
        password: hashedPassword,
        role,
        firstName,
        lastName,
        isActive,
      },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id } },
      update: {},
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id },
    });
    return { ...user, organizationId: DEFAULT_ORGANIZATION_ID };
  }

  function signToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, tokenVersion: user.tokenVersion || 0, organizationId: user.organizationId || DEFAULT_ORGANIZATION_ID },
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
    );
  }

  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await prisma.$disconnect();
    runtimePromise = null;
  }

  return {
    prisma,
    request,
    upsertUser,
    signToken,
    close,
    baseUrl,
  };
}

async function getTestRuntime() {
  if (!runtimePromise) {
    runtimePromise = createRuntime();
  }
  return runtimePromise;
}

module.exports = {
  getTestRuntime,
};
