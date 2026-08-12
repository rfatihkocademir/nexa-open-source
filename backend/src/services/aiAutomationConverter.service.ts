import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { StoredAutomationScenario, serializeScenario } from './automationStorage.service';
import { ProjectAccess } from '../utils/projectAccess';

export class AiAutomationConverterService {
  /**
   * Convert a manual TestCase into a Codeless AutomationScenario
   */
  async convertManualToAutomation(testCaseId: string, userId: string, role: string) {
    const testCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      include: {
        suite: { select: { projectId: true } },
        testCaseSteps: {
          include: { testStep: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!testCase) throw new AppError('Test case bulunamadı.', 404);
    const projectId = testCase.suite.projectId;
    // The route is intentionally protected at the service boundary as well.
    // A leaked/guessed test-case UUID must never be enough to mutate another
    // project or tenant.
    await ProjectAccess.check(projectId, userId, role);
    const testCaseTitle = testCase.title;

    // 1. Gather raw manual text from TestCase steps or description
    const manualStepsText: Array<{ action: string; expected?: string }> = [];

    if (testCase.testCaseSteps && testCase.testCaseSteps.length > 0) {
      for (const s of testCase.testCaseSteps) {
        manualStepsText.push({
          action: s.testStep.action || s.testStep.name || '',
          expected: s.testStep.expectedResult || undefined,
        });
      }
    } else if (Array.isArray(testCase.steps)) {
      for (const s of testCase.steps as any[]) {
        manualStepsText.push({
          action: s.action || s.name || '',
          expected: s.expectedResult || s.expected || undefined,
        });
      }
    } else {
      // Fallback: parse description or title if steps array is empty
      const descLines = (testCase.description || testCase.title || '').split('\n').filter(Boolean);
      for (const line of descLines) {
        manualStepsText.push({ action: line });
      }
    }

    // 1.5 Fetch project element catalog for smart selector matching
    const projectElements = await prisma.projectElement.findMany({
      where: { projectId },
    });

    // 2. Parse text into structured Codeless Playwright Automation Steps
    const parsedCodelessSteps = this.parseTextToCodelessActions(manualStepsText, testCaseTitle);

    // 3. Upsert AutomationScenario in DB
    let scenario = await prisma.automationScenario.findFirst({
      where: { testCaseId, deletedAt: null },
    });

    if (!scenario) {
      scenario = await prisma.automationScenario.create({
        data: {
          projectId,
          testCaseId,
          title: `[Auto] ${testCase.title}`,
          description: `Yapay zeka ile dönüştürülmüş otomatik test senaryosu: ${testCase.title}`,
          status: 'PUBLISHED',
          variables: { baseUrl: process.env.AUTOMATION_BASE_URL || process.env.FRONTEND_URL || 'https://nexa-app.local' },
        },
      });
    } else {
      // Clean previous steps
      await prisma.automationScenarioStep.deleteMany({
        where: { scenarioId: scenario.id },
      });
    }

    // 4. Create TestStep records and AutomationScenarioSteps, checking locators
    const createdScenarioSteps = [];
    const unmappedSteps: Array<{ index: number; name: string; reason: string }> = [];
    let orderIndex = 1;

    for (const actionDef of parsedCodelessSteps) {
      let finalLocator = actionDef.locator || '';

      // Try matching with ProjectElement catalog if locator is empty
      if (!finalLocator || finalLocator === '""') {
        const matchedElement = projectElements.find((el) =>
          actionDef.name.toLowerCase().includes(el.name.toLowerCase()) ||
          el.name.toLowerCase().includes(actionDef.name.toLowerCase())
        );
        if (matchedElement && matchedElement.locator) {
          finalLocator = matchedElement.locator;
        }
      }

      if (!finalLocator && actionDef.actionType !== 'WAIT' && actionDef.actionType !== 'NAVIGATE') {
        unmappedSteps.push({
          index: orderIndex,
          name: actionDef.name,
          reason: 'Bu adım için seçici (locator) bulunamadı. Lütfen manuel veya HTML Sihirli Öneri ile seçici belirleyin.',
        });
      }

      const testStep = await prisma.testStep.create({
        data: {
          projectId,
          name: actionDef.name,
          action: actionDef.actionText,
          expectedResult: actionDef.expectedResult,
          type: 'WEB',
          actionType: actionDef.actionType,
          locator: finalLocator,
          data: actionDef.data,
        },
      });

      // Automatically populate ProjectElement catalog for reusable elements
      if (finalLocator && actionDef.name) {
        const existingEl = await prisma.projectElement.findFirst({
          where: { projectId, name: actionDef.name },
        });
        if (existingEl) {
          await prisma.projectElement.update({
            where: { id: existingEl.id },
            data: { locator: finalLocator, type: actionDef.actionType },
          });
        } else {
          await prisma.projectElement.create({
            data: {
              projectId,
              name: actionDef.name,
              locator: finalLocator,
              type: actionDef.actionType,
            },
          });
        }
      }

      const scenarioStep = await prisma.automationScenarioStep.create({
        data: {
          scenarioId: scenario.id,
          testStepId: testStep.id,
          orderIndex: orderIndex++,
        },
        include: { testStep: true },
      });

      createdScenarioSteps.push(scenarioStep);
    }

    // 5. Update Legacy automationScript on TestCase for backwards compatibility
    const storedScenario: StoredAutomationScenario = {
      id: scenario.id,
      testCaseId,
      variables: (scenario.variables as Record<string, string>) || { baseUrl: 'https://nexa-app.local' },
      steps: createdScenarioSteps.map((s) => ({
        id: s.id,
        stepId: s.testStepId,
        orderIndex: s.orderIndex,
      })),
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        automationScript: serializeScenario(storedScenario),
      },
    });

    return {
      scenarioId: scenario.id,
      testCaseId,
      title: scenario.title,
      stepCount: createdScenarioSteps.length,
      steps: createdScenarioSteps,
      hasWarning: unmappedSteps.length > 0,
      unmappedSteps,
    };
  }

  /**
   * AI Rule Engine: Intelligently parse natural language manual steps into Playwright Actions
   */
  private parseTextToCodelessActions(
    manualSteps: Array<{ action: string; expected?: string }>,
    testCaseTitle: string
  ) {
    const actions: Array<{
      name: string;
      actionText: string;
      expectedResult?: string;
      actionType: string;
      locator?: string;
      data?: string;
    }> = [];

    // Always start with initial navigation step
    actions.push({
      name: 'Uygulamayı Aç',
      actionText: 'Ana sayfaya git',
      actionType: 'NAVIGATE',
      locator: 'body',
      data: '{{baseUrl}}',
    });

    for (const item of manualSteps) {
      const lower = item.action.toLowerCase();

      if (lower.includes('giriş') || lower.includes('login') || lower.includes('oturum')) {
        actions.push({
          name: 'E-posta Alanını Doldur',
          actionText: 'Giriş e-posta alanını doldur',
          actionType: 'FILL',
          locator: 'input[type="email"], input[name="email"], #email',
          data: '{{TEST_ADMIN_EMAIL}}',
        });
        actions.push({
          name: 'Şifre Alanını Doldur',
          actionText: 'Şifre gir',
          actionType: 'FILL',
          locator: 'input[type="password"], input[name="password"], #password',
          data: '{{TEST_ADMIN_PASSWORD}}',
        });
        actions.push({
          name: 'Giriş Yap Butonuna Tıkla',
          actionText: 'Giriş butonuna tıkla',
          actionType: 'CLICK',
          locator: 'button[type="submit"], button:has-text("Giriş"), #login-btn',
        });
      } else if (lower.includes('tıkla') || lower.includes('click') || lower.includes('seç')) {
        // Extract possible target element text
        const targetText = item.action.replace(/tıkla|click|seç|butonuna|linkine/gi, '').trim();
        actions.push({
          name: `Tıkla: ${targetText || 'Element'}`,
          actionText: item.action,
          expectedResult: item.expected,
          actionType: 'CLICK',
          locator: targetText ? `button:has-text("${targetText}"), a:has-text("${targetText}")` : 'button.primary',
        });
      } else if (lower.includes('yaz') || lower.includes('doldur') || lower.includes('enter') || lower.includes('input')) {
        actions.push({
          name: `Metin Gir: ${item.action}`,
          actionText: item.action,
          expectedResult: item.expected,
          actionType: 'FILL',
          locator: 'input:not([type="hidden"]), textarea',
          data: 'Test verisi',
        });
      } else if (lower.includes('doğrula') || lower.includes('kontrol') || lower.includes('verify') || lower.includes('assert') || item.expected) {
        const textToAssert = item.expected || item.action;
        actions.push({
          name: 'Metin Görünürlüğünü Doğrula',
          actionText: item.action,
          expectedResult: item.expected,
          actionType: 'ASSERT_TEXT',
          locator: 'body',
          data: textToAssert.substring(0, 30),
        });
      } else if (lower.includes('bekle') || lower.includes('wait')) {
        actions.push({
          name: 'Sayfa Yüklemesini Bekle',
          actionText: '2 saniye bekle',
          actionType: 'WAIT',
          data: '2000',
        });
      } else {
        // Default smart fallback action
        actions.push({
          name: item.action.substring(0, 40),
          actionText: item.action,
          expectedResult: item.expected,
          actionType: 'CLICK',
          locator: `text="${item.action.substring(0, 20)}"`,
        });
      }
    }

    // Always end with a screenshot step for visual proof
    actions.push({
      name: 'Sonuç Ekran Görüntüsü Al',
      actionText: 'Ekran görüntüsü kaydet',
      actionType: 'SCREENSHOT',
    });

    return actions;
  }
}

export const aiAutomationConverterService = new AiAutomationConverterService();
