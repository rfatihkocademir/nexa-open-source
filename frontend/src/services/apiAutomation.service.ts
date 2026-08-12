import { api } from './api';

export interface ApiExecutionPayload {
  projectId: string;
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

export interface ApiExecutionResultData {
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

export const apiAutomationService = {
  async executeStep(payload: ApiExecutionPayload): Promise<ApiExecutionResultData> {
    const res: any = await api.post('/api-automation/execute-step', payload);
    return res?.data || res;
  },

  async parseCurl(curlCommand: string): Promise<ApiExecutionPayload> {
    const res: any = await api.post('/api-automation/parse-curl', { curlCommand });
    return res?.data || res;
  },

  async importSwagger(projectId: string, swaggerJson: any): Promise<any> {
    const res: any = await api.post('/api-automation/import-swagger', { projectId, swaggerJson });
    return res?.data || res;
  },

  async generateAiApi(prompt: string): Promise<any> {
    const res: any = await api.post('/api-automation/generate-ai-api', { prompt });
    return res?.data || res;
  },
};
