import { BugSeverity, Priority, RequirementType, TicketStatus, TicketCategory, WorkItemType } from '@prisma/client';
import { SlaService } from './sla.service';

import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
const slaService = new SlaService();
const SERVICE_DESK_ROLES = new Set(['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT']);
const isServiceDeskRole = (role?: string) => SERVICE_DESK_ROLES.has(role || '');

export class ServiceDeskService {
  /**
   * Create a new Service Ticket and initialize its SLA Tracker
   */
  async createTicket(data: {
    organizationId: string;
    projectId: string;
    title: string;
    description?: string;
    category: TicketCategory;
    priority?: Priority;
    requesterEmail: string;
    requesterName?: string;
    userId?: string;
    role?: string;
  }) {
    if (!data.projectId?.trim() || !data.title?.trim() || !data.requesterEmail?.trim()) {
      throw new AppError('Proje, başlık ve talep eden e-posta alanları zorunludur.', 400);
    }
    if (!Object.values(TicketCategory).includes(data.category)) throw new AppError('Geçersiz ticket kategorisi.', 400);
    if (data.priority && !Object.values(Priority).includes(data.priority)) throw new AppError('Geçersiz ticket önceliği.', 400);

    const priority = data.priority || Priority.MEDIUM;

    const scopedProject = await prisma.project.findFirst({ where: { id: data.projectId, organizationId: data.organizationId }, select: { id: true } });
    if (!scopedProject) throw new AppError('Proje organizasyon kapsamında bulunamadı.', 404);
    if (!isServiceDeskRole(data.role)) {
      if (!data.userId) throw new AppError('Kullanıcı kimliği gerekli.', 401);
      await ProjectAccess.check(data.projectId, data.userId, data.role || 'USER');
      const requester = await prisma.user.findUnique({ where: { id: data.userId }, select: { email: true, firstName: true, lastName: true } });
      if (!requester || requester.email.toLowerCase() !== data.requesterEmail.trim().toLowerCase()) {
        throw new AppError('Talep eden kullanıcı kimliğiyle eşleşmiyor.', 403);
      }
    }

    // Atomically increment project ticket number and get project key
    const project = await prisma.project.update({
      where: { id: data.projectId },
      data: { nextTicketNumber: { increment: 1 } },
      select: { key: true, nextTicketNumber: true },
    });

    const sequenceNumber = project.nextTicketNumber - 1;
    const key = `${project.key}-TCK-${sequenceNumber}`;

    const ticket = await prisma.serviceTicket.create({
      data: {
        key,
        sequenceNumber,
        projectId: data.projectId,
        organizationId: data.organizationId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority,
        requesterEmail: data.requesterEmail,
        requesterName: data.requesterName,
        status: TicketStatus.OPEN,
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Initialize SLA tracker
    const slaTracker = await slaService.initializeTrackerForTicket(
      ticket.id,
      data.organizationId,
      data.projectId,
      priority
    );

    return {
      ...ticket,
      slaTracker,
    };
  }

  /**
   * List tickets for a project or organization with SLA trackers
   */
  async listTickets(params: {
    organizationId: string;
    projectId?: string;
    status?: TicketStatus;
    category?: TicketCategory;
    assigneeId?: string;
    search?: string;
    role?: string;
    requesterEmail?: string;
  }) {
    // Update active SLA statuses prior to returning
    await slaService.updateSlaStatuses(params.organizationId);

    const where: any = {
      organizationId: params.organizationId,
      deletedAt: null,
    };

    if (!isServiceDeskRole(params.role)) {
      if (!params.requesterEmail) throw new AppError('Ticket sahibi kapsamı gerekli.', 403);
      where.requesterEmail = params.requesterEmail.toLowerCase();
    }

    if (params.projectId) {
      const project = await prisma.project.findFirst({ where: { id: params.projectId, organizationId: params.organizationId }, select: { id: true } });
      if (!project) throw new AppError('Proje organizasyon kapsamında bulunamadı.', 404);
      where.projectId = params.projectId;
    }
    if (params.status) where.status = params.status;
    if (params.category) where.category = params.category;
    if (params.assigneeId) where.assigneeId = params.assigneeId;

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { key: { contains: params.search, mode: 'insensitive' } },
        { requesterEmail: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return prisma.serviceTicket.findMany({
      where,
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        linkedWorkItem: { select: { id: true, key: true, title: true, status: true } },
        slaTracker: { include: { policy: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get ticket by ID or key
   */
  async getTicket(identifier: string, organizationId: string, role = 'USER', requesterEmail?: string) {
    if (!isServiceDeskRole(role) && !requesterEmail) {
      throw new AppError('Ticket sahibi kapsamı gerekli.', 403);
    }
    const ticket = await prisma.serviceTicket.findFirst({
      where: {
        organizationId,
        OR: [{ id: identifier }, { key: identifier }],
        deletedAt: null,
        ...(!isServiceDeskRole(role) && requesterEmail ? { requesterEmail: requesterEmail.toLowerCase() } : {}),
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        linkedWorkItem: { select: { id: true, key: true, title: true, status: true } },
        slaTracker: { include: { policy: true } },
        comments: {
          where: ['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT'].includes(role) ? undefined : { isInternal: false },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new AppError('Bilet bulunamadı.', 404);
    return ticket;
  }

  /**
   * Update ticket status / assignee / priority
   */
  async updateTicket(
    id: string,
    organizationId: string,
    data: {
      status?: TicketStatus;
      assigneeId?: string | null;
      priority?: Priority;
      category?: TicketCategory;
    }
  , role = 'USER'
  ) {
    if (!['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT'].includes(role)) throw new AppError('Bu işlem için Service Desk yetkisi gerekli.', 403);
    const existing = await this.getTicket(id, organizationId, role);

    if (data.assigneeId) {
      const assignee = await prisma.organizationMember.findFirst({
        where: { organizationId, userId: data.assigneeId, user: { isActive: true } },
        select: { userId: true },
      });
      if (!assignee) throw new AppError('Atanan kullanıcı bu organizasyonda bulunamadı.', 400);
    }

    const updated = await prisma.serviceTicket.update({
      where: { id: existing.id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.priority && { priority: data.priority }),
        ...(data.category && { category: data.category }),
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        slaTracker: { include: { policy: true } },
      },
    });

    if (data.status) {
      await slaService.handleStatusChange(existing.id, data.status);
    }

    return updated;
  }

  /**
   * Add a comment to ticket and trigger first response SLA if applicable
   */
  async addComment(
    ticketId: string,
    organizationId: string,
    authorId: string | null,
    content: string,
    isInternal = false,
    role = 'USER',
    requesterEmail?: string,
  ) {
    if (!content?.trim()) throw new AppError('Yorum boş olamaz.', 400);
    if (isInternal && !['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT'].includes(role)) throw new AppError('Internal note yetkisi gerekli.', 403);
    const ticket = await this.getTicket(ticketId, organizationId, role, requesterEmail);

    const comment = await prisma.serviceTicketComment.create({
      data: {
        ticketId: ticket.id,
        authorId,
        content,
        isInternal,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    // If author is agent (authorId is present and not requester), record first response
    if (authorId && !isInternal) {
      await slaService.recordFirstResponse(ticket.id);
    }

    return comment;
  }

  /**
   * Convert Service Ticket to Agile WorkItem (Bug or Task)
   */
  async convertToWorkItem(ticketId: string, organizationId: string, targetType: WorkItemType = 'BUG', actorId?: string, role = 'USER') {
    if (!['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT'].includes(role)) throw new AppError('Bu işlem için Service Desk yetkisi gerekli.', 403);
    if (!actorId) throw new AppError('Dönüşüm için kullanıcı kimliği gerekli.', 401);
    const allowedTargetTypes: WorkItemType[] = ['BUG', 'TASK', 'STORY'];
    if (!allowedTargetTypes.includes(targetType)) throw new AppError('Geçersiz iş öğesi tipi.', 400);
    const conversionType = targetType as 'BUG' | 'TASK' | 'STORY';

    const workItem = await prisma.$transaction(async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({
        where: { id: ticketId, organizationId, deletedAt: null },
      });
      if (!ticket) throw new AppError('Bilet bulunamadı.', 404);
      if (ticket.linkedWorkItemId) throw new AppError('Bu bilet zaten bir iş öğesine dönüştürülmüş.', 409);

      const project = await tx.project.findFirst({
        where: { id: ticket.projectId, organizationId },
        select: { id: true, key: true, nextWorkItemNumber: true },
      });
      if (!project) throw new AppError('Bilet projesi organizasyon kapsamında bulunamadı.', 404);

      const requirement = await tx.requirement.create({
        data: {
          projectId: project.id,
          authorId: actorId,
          title: `[ServiceDesk] ${ticket.title}`,
          description: `Bilet Key: ${ticket.key}\nTalep Eden: ${ticket.requesterEmail}\n\n${ticket.description || ''}`,
          type: RequirementType.FUNCTIONAL,
          status: 'APPROVED',
        },
      });

      const nextProject = await tx.project.update({
        where: { id: project.id },
        data: { nextWorkItemNumber: { increment: 1 } },
        select: { key: true, nextWorkItemNumber: true },
      });
      const sequenceNumber = nextProject.nextWorkItemNumber - 1;
      const workItem = await tx.workItem.create({
        data: {
          key: `${nextProject.key}-${sequenceNumber}`,
          sequenceNumber,
          projectId: project.id,
          title: `[ServiceDesk] ${ticket.title}`,
          description: `Bilet Key: ${ticket.key}\nTalep Eden: ${ticket.requesterEmail}\n\nAçıklama:\n${ticket.description || ''}`,
          priority: ticket.priority,
          itemType: conversionType,
          status: conversionType === 'BUG' ? 'OPEN' : 'BACKLOG',
          severity: conversionType === 'BUG' ? BugSeverity.MEDIUM : null,
          stepsToReproduce: conversionType === 'BUG' ? (ticket.description || 'Service Desk üzerinden bildirilen hata.') : null,
          assigneeId: ticket.assigneeId,
          reporterId: actorId,
          requirementId: requirement.id,
        },
      });

      await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: { linkedWorkItemId: workItem.id, status: TicketStatus.IN_PROGRESS },
      });
      return workItem;
    });

    await slaService.handleStatusChange(ticketId, TicketStatus.IN_PROGRESS);
    return workItem;
  }

  /**
   * SLA Policy CRUD
   */
  async createSlaPolicy(data: {
    organizationId: string;
    projectId?: string;
    name: string;
    description?: string;
    priority: Priority;
    firstResponseTargetMinutes: number;
    resolutionTargetMinutes: number;
    isBusinessHoursOnly?: boolean;
  }, role = 'USER') {
    if (!['ADMIN', 'TEAM_LEADER', 'SERVICE_DESK_AGENT'].includes(role)) throw new AppError('SLA policy yetkisi gerekli.', 403);
    if (!data.name?.trim() || !Number.isInteger(data.firstResponseTargetMinutes) || data.firstResponseTargetMinutes <= 0 ||
      !Number.isInteger(data.resolutionTargetMinutes) || data.resolutionTargetMinutes <= 0) {
      throw new AppError('SLA adı ve pozitif hedef süreleri zorunludur.', 400);
    }
    if (!Object.values(Priority).includes(data.priority)) throw new AppError('Geçersiz SLA önceliği.', 400);
    if (data.projectId && !(await prisma.project.findFirst({ where: { id: data.projectId, organizationId: data.organizationId }, select: { id: true } }))) throw new AppError('Proje organizasyon kapsamında bulunamadı.', 404);
    return prisma.slaPolicy.create({
      data: {
        organizationId: data.organizationId,
        projectId: data.projectId || null,
        name: data.name,
        description: data.description,
        priority: data.priority,
        firstResponseTargetMinutes: data.firstResponseTargetMinutes,
        resolutionTargetMinutes: data.resolutionTargetMinutes,
        isBusinessHoursOnly: data.isBusinessHoursOnly ?? true,
      },
    });
  }

  async listSlaPolicies(organizationId: string, projectId?: string, role = 'USER') {
    if (!isServiceDeskRole(role)) throw new AppError('SLA policy yetkisi gerekli.', 403);
    if (projectId && !(await prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } }))) {
      throw new AppError('Proje organizasyon kapsamında bulunamadı.', 404);
    }
    return prisma.slaPolicy.findMany({
      where: {
        organizationId,
        ...(projectId && { projectId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Submit Customer Satisfaction (CSAT) rating for a resolved ticket
   */
  async rateTicket(ticketId: string, organizationId: string, requesterEmail: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw new AppError('Puan 1 ile 5 arasında olmalıdır.', 400);

    const ticket = await prisma.serviceTicket.findFirst({ where: { id: ticketId, organizationId, deletedAt: null } });
    if (!ticket) throw new AppError('Bilet bulunamadı.', 404);
    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) throw new AppError('Yalnızca çözümlenmiş biletler puanlanabilir.', 409);
    if (ticket.satisfactionRating !== null) throw new AppError('Bu bilet daha önce puanlandı.', 409);
    if (ticket.requesterEmail.toLowerCase() !== requesterEmail.toLowerCase()) throw new AppError('Yalnızca bilet sahibi puanlayabilir.', 403);

    return prisma.serviceTicket.update({
      where: { id: ticket.id },
      data: {
        satisfactionRating: rating,
        satisfactionComment: comment,
      },
    });
  }

  /**
   * Get Service Desk Analytics & Metrics for Organization or Project
   */
  async getAnalytics(organizationId: string, projectId?: string, role = 'USER', requesterEmail?: string) {
    await slaService.updateSlaStatuses(organizationId);

    if (projectId && !(await prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } }))) {
      throw new AppError('Proje organizasyon kapsamında bulunamadı.', 404);
    }

    const where: any = { organizationId, deletedAt: null };
    if (projectId) where.projectId = projectId;
    if (!isServiceDeskRole(role)) {
      if (!requesterEmail) throw new AppError('Ticket sahibi kapsamı gerekli.', 403);
      where.requesterEmail = requesterEmail.toLowerCase();
    }

    const tickets = await prisma.serviceTicket.findMany({
      where,
      include: { slaTracker: true },
    });

    const totalTickets = tickets.length;
    const openTickets = tickets.filter((t) => t.status === TicketStatus.OPEN || t.status === TicketStatus.IN_PROGRESS).length;
    const resolvedTickets = tickets.filter((t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length;

    const breachedCount = tickets.filter(
      (t) => t.slaTracker?.status === 'BREACHED' || t.slaTracker?.isResolutionBreached || t.slaTracker?.isFirstResponseBreached
    ).length;

    const slaComplianceRate = totalTickets > 0 ? Math.round(((totalTickets - breachedCount) / totalTickets) * 100) : 100;

    // CSAT calculation
    const ratedTickets = tickets.filter((t) => t.satisfactionRating !== null && t.satisfactionRating !== undefined);
    const avgCsat =
      ratedTickets.length > 0
        ? (ratedTickets.reduce((acc, t) => acc + (t.satisfactionRating || 0), 0) / ratedTickets.length).toFixed(1)
        : '5.0';

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      breachedCount,
      slaComplianceRate,
      csatScore: parseFloat(avgCsat),
      ratedTicketCount: ratedTickets.length,
    };
  }
}
