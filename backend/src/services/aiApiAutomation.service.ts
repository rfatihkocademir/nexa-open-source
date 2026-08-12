import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

export class AiApiAutomationService {
  /**
   * Parse a cURL command string into structured API Request parameters
   */
  parseCurlCommand(curlCommand: string) {
    if (!curlCommand || !curlCommand.trim()) {
      throw new AppError('Geçerli bir cURL komutu giriniz.', 400);
    }

    const cleanCurl = curlCommand.replace(/\\\n/g, ' ').trim();

    // Extract URL (find token starting with http://, https://, or non-option token)
    const httpUrlMatch = cleanCurl.match(/https?:\/\/[^\s'"]+/i);
    let url = httpUrlMatch ? httpUrlMatch[0] : '';
    if (!url) {
      const tokens = cleanCurl.split(/\s+/);
      for (let i = 1; i < tokens.length; i++) {
        if (!tokens[i].startsWith('-') && !tokens[i - 1].startsWith('-')) {
          url = tokens[i].replace(/['"]/g, '');
          break;
        }
      }
    }

    // Extract Method
    let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET';
    const methodMatch = cleanCurl.match(/-X\s+([A-Z]+)/i) || cleanCurl.match(/--request\s+([A-Z]+)/i);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase() as any;
    } else if (cleanCurl.includes('-d ') || cleanCurl.includes('--data')) {
      method = 'POST';
    }

    // Extract Headers
    const headers: Record<string, string> = {};
    const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
    let match: RegExpExecArray | null;
    while ((match = headerRegex.exec(cleanCurl)) !== null) {
      const headerStr = match[1];
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex > 0) {
        const key = headerStr.substring(0, colonIndex).trim();
        const value = headerStr.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Extract Body Payload
    let body: any = null;
    const bodyMatch = cleanCurl.match(/(?:-d|--data|--data-raw)\s+(['"])([\s\S]*?)\1/i);
    if (bodyMatch) {
      try {
        body = JSON.parse(bodyMatch[2]);
      } catch {
        body = bodyMatch[2];
      }
    }

    return {
      url,
      method,
      headers,
      body,
      assertions: [
        { type: 'STATUS_CODE', expectedValue: 200, operator: 'EQUALS' },
        { type: 'RESPONSE_TIME', expectedValue: 1000, operator: 'LESS_THAN' },
      ],
    };
  }

  /**
   * Generate an entire API Test Scenario from Swagger / OpenAPI spec JSON
   */
  async importSwaggerSpec(projectId: string, swaggerJson: any, userId: string, role: string) {
    await ProjectAccess.check(projectId, userId, role);

    if (!swaggerJson || !swaggerJson.paths) {
      throw new AppError('Geçerli bir OpenAPI / Swagger JSON verisi sunulmalıdır.', 400);
    }
    if (typeof swaggerJson.paths !== 'object' || Array.isArray(swaggerJson.paths)) {
      throw new AppError('OpenAPI paths alanı geçersiz.', 400);
    }

    const title = swaggerJson.info?.title || 'OpenAPI Import Scenario';
    const baseUrl = swaggerJson.servers?.[0]?.url || 'https://api.example.com';
    if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) {
      throw new AppError('OpenAPI server URL geçersiz.', 400);
    }

    const endpointDefinitions = Object.entries(swaggerJson.paths as Record<string, any>).flatMap(([pathUrl, methods]) =>
      Object.entries((methods || {}) as Record<string, any>)
        .filter(([httpMethod]) => ['get', 'post', 'put', 'delete', 'patch'].includes(httpMethod.toLowerCase()))
        .map(([httpMethod, operation]) => ({ pathUrl, httpMethod, operation: operation || {} }))
    );
    if (endpointDefinitions.length === 0) throw new AppError('OpenAPI dokümanında desteklenen endpoint bulunamadı.', 400);
    if (endpointDefinitions.length > 500) throw new AppError('Tek import işleminde en fazla 500 endpoint desteklenir.', 400);

    const { scenario, generatedSteps } = await prisma.$transaction(async (tx) => {
      let suite = await tx.testSuite.findFirst({ where: { projectId, deletedAt: null } });
      if (!suite) {
        suite = await tx.testSuite.create({
          data: { projectId, name: 'API Automation Suite', description: 'Otomatik OpenAPI import test paketleri' },
        });
      }

      let testCase = await tx.testCase.findFirst({ where: { suiteId: suite.id, deletedAt: null } });
      if (!testCase) {
        const project = await tx.project.update({
          where: { id: projectId },
          data: { nextTestCaseNumber: { increment: 1 } },
          select: { key: true, nextTestCaseNumber: true },
        });
        const sequenceNumber = project.nextTestCaseNumber - 1;
        testCase = await tx.testCase.create({
          data: {
            suiteId: suite.id,
            key: `${project.key}-TC-${sequenceNumber}`,
            sequenceNumber,
            title: `[API Suite] ${title}`,
            description: 'OpenAPI Swagger Import Test Paketi',
            authorId: userId,
          },
        });
      }

      const scenario = await tx.automationScenario.create({
        data: {
          projectId,
          testCaseId: testCase.id,
          title: `[API Import] ${title}`,
          description: 'OpenAPI spec import ile oluşturulmuş API otomasyon senaryosu paketidir.',
          status: 'PUBLISHED',
          variables: { baseUrl },
        },
      });

      const generatedSteps = [];
      for (const [index, endpoint] of endpointDefinitions.entries()) {
        const { pathUrl, httpMethod, operation } = endpoint;
        const fullUrl = `{{baseUrl}}${pathUrl}`;
        const stepTitle = `${httpMethod.toUpperCase()} ${pathUrl} (${operation.summary || operation.operationId || 'Test'})`;
        const testStep = await tx.testStep.create({
          data: {
            projectId,
            name: stepTitle,
            action: `${httpMethod.toUpperCase()} ${fullUrl}`,
            expectedResult: 'HTTP Status Code 200 veya 201 beklenir',
            type: 'WEB',
            actionType: 'API_REQUEST',
            data: JSON.stringify({
              url: fullUrl,
              method: httpMethod.toUpperCase(),
              headers: { 'Content-Type': 'application/json' },
              assertions: [{ type: 'STATUS_CODE', expectedValue: 200, operator: 'EQUALS' }],
            }),
          },
        });
        generatedSteps.push(await tx.automationScenarioStep.create({
          data: { scenarioId: scenario.id, testStepId: testStep.id, orderIndex: index + 1 },
          include: { testStep: true },
        }));
      }
      return { scenario, generatedSteps };
    });

    return {
      scenarioId: scenario.id,
      title: scenario.title,
      totalEndpoints: generatedSteps.length,
      steps: generatedSteps,
    };
  }

  /**
   * Generate API steps from Natural Language AI Prompt
   */
  generateApiFromPrompt(prompt: string) {
    const lower = prompt.toLowerCase();
    let method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
    let url = '{{baseUrl}}/api/v1/resource';

    if (lower.includes('post') || lower.includes('oluştur') || lower.includes('ekle') || lower.includes('kaydet')) {
      method = 'POST';
    } else if (lower.includes('put') || lower.includes('güncelle')) {
      method = 'PUT';
    } else if (lower.includes('delete') || lower.includes('sil')) {
      method = 'DELETE';
    }

    if (lower.includes('user') || lower.includes('kullanıcı')) {
      url = '{{baseUrl}}/api/v1/users';
    } else if (lower.includes('order') || lower.includes('sipariş')) {
      url = '{{baseUrl}}/api/v1/orders';
    } else if (lower.includes('login') || lower.includes('giriş') || lower.includes('auth')) {
      url = '{{baseUrl}}/api/v1/auth/login';
      method = 'POST';
    }

    return {
      name: `${method} API Testi: ${prompt.substring(0, 30)}`,
      url,
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer {{token}}' },
      body: method !== 'GET' ? { username: 'testuser', status: 'ACTIVE' } : undefined,
      assertions: [
        { type: 'STATUS_CODE', expectedValue: method === 'POST' ? 201 : 200, operator: 'EQUALS' },
        { type: 'RESPONSE_TIME', expectedValue: 800, operator: 'LESS_THAN' },
      ],
    };
  }
}

export const aiApiAutomationService = new AiApiAutomationService();
