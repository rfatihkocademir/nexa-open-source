import { Request, Response } from 'express';
import { apiExecutionService } from '../services/apiExecution.service';
import { aiApiAutomationService } from '../services/aiApiAutomation.service';

export class ApiAutomationController {
  /**
   * Execute an isolated API Request & Assertion evaluation
   */
  async executeStep(req: Request, res: Response) {
    try {
      const { url, method, headers, queryParams, body, assertions } = req.body;
      if (!url || !method) {
        return res.status(400).json({ error: 'URL ve HTTP Method zorunludur.' });
      }

      const result = await apiExecutionService.executeApiRequest({
        url,
        method,
        headers,
        queryParams,
        body,
        assertions,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * Parse cURL string into No-Code API Step format
   */
  async parseCurl(req: Request, res: Response) {
    try {
      const { curlCommand } = req.body;
      const parsed = aiApiAutomationService.parseCurlCommand(curlCommand);

      return res.json({
        success: true,
        data: parsed,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * Import Swagger / OpenAPI Spec
   */
  async importSwagger(req: Request, res: Response) {
    try {
      const { projectId, swaggerJson } = req.body;
      const userId = req.user!.id;
      const role = req.user!.role;

      if (!projectId || !swaggerJson) {
        return res.status(400).json({ error: 'ProjectId ve Swagger/OpenAPI JSON zorunludur.' });
      }

      const result = await aiApiAutomationService.importSwaggerSpec(projectId, swaggerJson, userId, role);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  /**
   * Generate API Step from AI Prompt
   */
  async generateAiApi(req: Request, res: Response) {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt zorunludur.' });
      }

      const generated = aiApiAutomationService.generateApiFromPrompt(prompt);

      return res.json({
        success: true,
        data: generated,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export const apiAutomationController = new ApiAutomationController();
