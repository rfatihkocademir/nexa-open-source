import { test, expect } from '@playwright/test';
import { apiExecutionService } from '../../src/services/apiExecution.service';
import { aiApiAutomationService } from '../../src/services/aiApiAutomation.service';

test.describe('API Automation & Integration Studio Tests', () => {
  test('should parse cURL commands into structured No-Code API request step', async () => {
    const curl = `curl -X POST https://api.nexa.io/v1/auth/login -H 'Content-Type: application/json' -H 'Authorization: Bearer test123' -d '{"username":"admin","pass":"secret"}'`;
    
    const parsed = aiApiAutomationService.parseCurlCommand(curl);

    expect(parsed.url).toBe('https://api.nexa.io/v1/auth/login');
    expect(parsed.method).toBe('POST');
    expect(parsed.headers['Content-Type']).toBe('application/json');
    expect(parsed.headers['Authorization']).toBe('Bearer test123');
    expect(parsed.body).toEqual({ username: 'admin', pass: 'secret' });
    expect(parsed.assertions.length).toBeGreaterThanOrEqual(1);
  });

  test('should generate AI API step structure from natural language prompt', async () => {
    const prompt = 'Stripe payment endpoint için POST isteği oluştur ve 200 dönmesini doğrula';
    const generated = aiApiAutomationService.generateApiFromPrompt(prompt);

    expect(generated.method).toBe('POST');
    expect(generated.url).toContain('{{baseUrl}}');
    expect(generated.assertions[0].type).toBe('STATUS_CODE');
    expect(generated.assertions[0].expectedValue).toBe(201);
  });

  test('should execute live API request mock and evaluate status & jsonpath assertions', async () => {
    const mockStep = {
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      method: 'GET' as const,
      assertions: [
        { type: 'STATUS_CODE' as const, expectedValue: 200, operator: 'EQUALS' as const },
        { type: 'RESPONSE_TIME' as const, expectedValue: 5000, operator: 'LESS_THAN' as const },
      ],
    };

    const result = await apiExecutionService.executeApiRequest(mockStep);

    expect(result.statusCode).toBe(200);
    expect(result.responseTimeMs).toBeGreaterThan(0);
    expect(result.assertionResults.length).toBe(2);
    expect(result.assertionResults[0].passed).toBe(true);
  });

  test('should reject private targets and malformed request bodies before network access', async () => {
    let privateError: any;
    try {
      await apiExecutionService.executeApiRequest({
        url: 'http://[::ffff:127.0.0.1]/admin',
        method: 'GET',
      });
    } catch (error) {
      privateError = error;
    }
    expect(privateError?.statusCode).toBe(403);

    let bodyError: any;
    try {
      await apiExecutionService.executeApiRequest({
        url: 'https://example.com',
        method: 'POST',
        body: '{invalid-json',
      });
    } catch (error) {
      bodyError = error;
    }
    expect(bodyError?.statusCode).toBe(400);
  });
});
