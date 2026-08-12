import { Request, Response } from 'express';
import { ServiceDeskService } from '../services/service-desk.service';
import { respondWithControllerError } from '../utils/controllerError';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

const serviceDeskService = new ServiceDeskService();
const SERVICE_DESK_ROLES = new Set(['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT']);

export class ServiceDeskController {
  private async currentUser(req: Request) {
    if (!req.user?.id) throw new AppError('Kimlik bilgisi gerekli.', 401);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user) throw new AppError('Kullanıcı bulunamadı.', 401);
    return user;
  }

  private isPrivileged(req: Request) {
    return SERVICE_DESK_ROLES.has(req.user?.role || '');
  }

  async createTicket(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const actor = await this.currentUser(req);
      const privileged = this.isPrivileged(req);
      const ticket = await serviceDeskService.createTicket({
        organizationId,
        projectId: req.body.projectId,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        priority: req.body.priority,
        requesterEmail: privileged ? req.body.requesterEmail : actor.email,
        requesterName: privileged ? req.body.requesterName : [actor.firstName, actor.lastName].filter(Boolean).join(' '),
        userId: req.user?.id,
        role: req.user?.role,
      });

      return res.status(201).json(ticket);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async listTickets(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const actor = this.isPrivileged(req) ? undefined : await this.currentUser(req);
      const tickets = await serviceDeskService.listTickets({
        organizationId,
        projectId: req.query.projectId as string,
        status: req.query.status as any,
        category: req.query.category as any,
        assigneeId: req.query.assigneeId as string,
        search: req.query.search as string,
        role: req.user?.role,
        requesterEmail: actor?.email,
      });

      return res.json(tickets);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async getTicket(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const actor = this.isPrivileged(req) ? undefined : await this.currentUser(req);
      const ticket = await serviceDeskService.getTicket(req.params.id, organizationId, req.user?.role, actor?.email);
      return res.json(ticket);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async updateTicket(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const ticket = await serviceDeskService.updateTicket(req.params.id, organizationId, {
        status: req.body.status,
        assigneeId: req.body.assigneeId,
        priority: req.body.priority,
        category: req.body.category,
      }, req.user?.role);

      return res.json(ticket);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async addComment(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const actor = this.isPrivileged(req) ? undefined : await this.currentUser(req);
      const comment = await serviceDeskService.addComment(
        req.params.id,
        organizationId,
        req.user?.id || null,
        req.body.content,
        req.body.isInternal ?? false,
        req.user?.role,
        actor?.email,
      );

      return res.status(201).json(comment);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async convertToWorkItem(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const workItem = await serviceDeskService.convertToWorkItem(
        req.params.id,
        organizationId,
        req.body.targetType || 'BUG',
        req.user?.id,
        req.user?.role
      );

      return res.status(201).json(workItem);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  // SLA Policy Handlers
  async createSlaPolicy(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const policy = await serviceDeskService.createSlaPolicy({
        organizationId,
        projectId: req.body.projectId,
        name: req.body.name,
        description: req.body.description,
        priority: req.body.priority,
        firstResponseTargetMinutes: Number(req.body.firstResponseTargetMinutes),
        resolutionTargetMinutes: Number(req.body.resolutionTargetMinutes),
        isBusinessHoursOnly: req.body.isBusinessHoursOnly,
      }, req.user?.role);

      return res.status(201).json(policy);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async listSlaPolicies(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const policies = await serviceDeskService.listSlaPolicies(organizationId, req.query.projectId as string, req.user?.role);
      return res.json(policies);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async rateTicket(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId || !req.user?.id) return res.status(401).json({ error: 'Kimlik bilgisi gerekli.' });
      const requester = await import('../utils/prisma').then(({ default: db }) => db.user.findUnique({ where: { id: req.user!.id }, select: { email: true } }));
      if (!requester) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
      const ticket = await serviceDeskService.rateTicket(
        req.params.id,
        organizationId,
        requester.email,
        Number(req.body.rating),
        req.body.comment
      );
      return res.json(ticket);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }

  async getAnalytics(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Organizasyon kimliği gerekli.' });

      const actor = this.isPrivileged(req) ? undefined : await this.currentUser(req);
      const stats = await serviceDeskService.getAnalytics(
        organizationId,
        req.query.projectId as string,
        req.user?.role,
        actor?.email,
      );
      return res.json(stats);
    } catch (error: any) {
      return respondWithControllerError(res, error);
    }
  }
}
