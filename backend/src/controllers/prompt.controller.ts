import { Request, Response } from 'express';
import { promptService } from '../services/prompt.service';
import { respondWithControllerError } from '../utils/controllerError';

export class PromptController {
  static async listTemplates(req: Request, res: Response) {
    try {
      const templates = await promptService.listTemplates();
      res.json(templates);
    } catch (error) {
      respondWithControllerError(res, error);
    }
  }

  static async getTemplateDetails(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const template = await promptService.getTemplateDetails(slug);
      if (!template) {
        return res.status(404).json({ error: 'Prompt template not found' });
      }
      res.json(template);
    } catch (error) {
      respondWithControllerError(res, error);
    }
  }

  static async createTemplate(req: Request, res: Response) {
    try {
      const { slug, name, description } = req.body;
      const template = await promptService.createTemplate(slug, name, description);
      res.status(201).json(template);
    } catch (error) {
      respondWithControllerError(res, error);
    }
  }

  static async addVersion(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const version = await promptService.addVersion(slug, {
        ...req.body,
        createdById: req.user?.id,
      });
      res.status(201).json(version);
    } catch (error) {
      respondWithControllerError(res, error);
    }
  }

  static async activateVersion(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const { version } = req.body;
      const template = await promptService.activateVersion(slug, version);
      res.json(template);
    } catch (error) {
      respondWithControllerError(res, error);
    }
  }
}
