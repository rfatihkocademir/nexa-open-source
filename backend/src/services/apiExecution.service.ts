import axios, { AxiosRequestConfig } from 'axios';
import { AppError } from '../utils/AppError';
import { assertSafeOutboundTarget } from '../utils/outboundTarget';

export interface ApiExecutionParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
  assertions?: Array<{
    type: 'STATUS_CODE' | 'JSON_PATH' | 'RESPONSE_TIME' | 'HEADER';
    target?: string;
    operator: 'EQUALS' | 'CONTAINS' | 'LESS_THAN' | 'GREATER_THAN' | 'EXISTS';
    expectedValue?: any;
  }>;
}

export interface ApiExecutionResult {
  success: boolean;
  statusCode: number;
  statusText: string;
  responseTimeMs: number;
  headers: Record<string, string>;
  data: any;
  assertionResults: Array<{
    type: string;
    target?: string;
    expected: any;
    actual: any;
    passed: boolean;
    message: string;
  }>;
}

export class ApiExecutionService {
  private async assertSafeTarget(rawUrl: string): Promise<void> {
    await assertSafeOutboundTarget(rawUrl, { scope: 'api' });
  }
  /**
   * Execute an isolated API Request and run assertions
   */
  async executeApiRequest(params: ApiExecutionParams): Promise<ApiExecutionResult> {
    await this.assertSafeTarget(params.url);
    const startTime = Date.now();
    let response: any = null;
    let errorResponse: any = null;

    let requestBody: any = undefined;
    if (params.body !== undefined && params.body !== null) {
      try {
        requestBody = typeof params.body === 'string' ? JSON.parse(params.body) : params.body;
      } catch {
        throw new AppError('Request body must be valid JSON', 400);
      }
    }

    const axiosConfig: AxiosRequestConfig = {
      url: params.url,
      method: params.method,
      headers: params.headers || {},
      params: params.queryParams || {},
      data: requestBody,
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 1024 * 1024,
      maxRedirects: 0,
      validateStatus: () => true, // Don't throw on error status codes
    };

    try {
      response = await axios(axiosConfig);
    } catch (err: any) {
      errorResponse = err;
    }

    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    const statusCode = response ? response.status : 0;
    const statusText = response ? response.statusText : (errorResponse?.message || 'NETWORK_ERROR');
    const responseHeaders = response ? response.headers : {};
    const responseData = response ? response.data : { error: errorResponse?.message || 'Execution Failed' };

    // Evaluate Assertions
    const assertionResults = (params.assertions || []).map((assertion) => {
      let passed = false;
      let actual: any = null;
      let message = '';

      if (assertion.type === 'STATUS_CODE') {
        actual = statusCode;
        const expected = Number(assertion.expectedValue || 200);
        passed = statusCode === expected;
        message = passed
          ? `Status Code matches expected ${expected}`
          : `Expected status code ${expected}, but got ${statusCode}`;
      } else if (assertion.type === 'RESPONSE_TIME') {
        actual = responseTimeMs;
        const expected = Number(assertion.expectedValue || 1000);
        passed = responseTimeMs <= expected;
        message = passed
          ? `Response time (${responseTimeMs}ms) <= ${expected}ms`
          : `Response time (${responseTimeMs}ms) exceeded maximum ${expected}ms`;
      } else if (assertion.type === 'JSON_PATH') {
        actual = this.getValueByJsonPath(responseData, assertion.target || '');
        const expected = assertion.expectedValue;

        if (assertion.operator === 'EQUALS') {
          passed = String(actual) === String(expected);
        } else if (assertion.operator === 'CONTAINS') {
          passed = String(actual).includes(String(expected));
        } else if (assertion.operator === 'EXISTS') {
          passed = actual !== undefined && actual !== null;
        }

        message = passed
          ? `JSONPath '${assertion.target}' assertion passed`
          : `JSONPath '${assertion.target}': Expected ${expected}, got ${actual}`;
      } else if (assertion.type === 'HEADER') {
        const headerKey = (assertion.target || '').toLowerCase();
        actual = responseHeaders[headerKey] || responseHeaders[assertion.target || ''];
        passed = actual !== undefined && actual !== null;
        message = passed ? `Header '${assertion.target}' exists` : `Header '${assertion.target}' missing`;
      }

      return {
        type: assertion.type,
        target: assertion.target,
        expected: assertion.expectedValue,
        actual,
        passed,
        message,
      };
    });

    const allPassed = assertionResults.length === 0 ? statusCode >= 200 && statusCode < 400 : assertionResults.every((a) => a.passed);

    return {
      success: allPassed,
      statusCode,
      statusText,
      responseTimeMs,
      headers: responseHeaders,
      data: responseData,
      assertionResults,
    };
  }

  private getValueByJsonPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const cleanPath = path.replace(/^\$\./, '').replace(/^\[/, '').replace(/\]$/, '');
    const parts = cleanPath.split(/\.|\/|\[|\]/).filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
}

export const apiExecutionService = new ApiExecutionService();
