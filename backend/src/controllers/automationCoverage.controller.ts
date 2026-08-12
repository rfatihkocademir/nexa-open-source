import { Request, Response } from 'express';
import { aiAutomationConverterService } from '../services/aiAutomationConverter.service';
import { automationCoverageService } from '../services/automationCoverage.service';

export class AutomationCoverageController {
  async convertManualToAutomation(req: Request, res: Response) {
    try {
      const { testCaseId } = req.body;
      if (!testCaseId) return res.status(400).json({ error: 'testCaseId zorunludur.' });

      const result = await aiAutomationConverterService.convertManualToAutomation(
        testCaseId,
        req.user!.id,
        req.user!.role
      );

      return res.json({
        success: true,
        message: 'Manuel test yapay zeka ile başarıyla kodsuz otomasyona dönüştürüldü.',
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getProjectCoverageMetrics(req: Request, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId zorunludur.' });

      const metrics = projectId === 'global'
        ? await automationCoverageService.getOrganizationCoverageMetrics(req.user!.organizationId!, req.user!.id, req.user!.role)
        : await automationCoverageService.getProjectCoverageMetrics(projectId, req.user!.id, req.user!.role);

      return res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export const automationCoverageController = new AutomationCoverageController();
