import { PrismaClient, Priority, TicketStatus, SlaStatus } from '@prisma/client';
import prisma from '../utils/prisma';

export class SlaService {
  private addBusinessMinutes(start: Date, minutes: number): Date {
    const result = new Date(start);
    let remaining = Math.max(0, minutes);
    while (remaining > 0) {
      const day = result.getDay();
      if (day === 0 || day === 6 || result.getHours() < 9 || result.getHours() >= 18) {
        result.setDate(result.getDate() + (day === 6 ? 2 : day === 0 ? 1 : 0));
        result.setHours(9, 0, 0, 0);
        continue;
      }
      const endOfDay = new Date(result);
      endOfDay.setHours(18, 0, 0, 0);
      const available = Math.max(1, Math.floor((endOfDay.getTime() - result.getTime()) / 60000));
      const consumed = Math.min(remaining, available);
      result.setMinutes(result.getMinutes() + consumed);
      remaining -= consumed;
      if (remaining > 0) {
        result.setDate(result.getDate() + 1);
        result.setHours(9, 0, 0, 0);
      }
    }
    return result;
  }

  private dueAt(start: Date, minutes: number, businessHoursOnly: boolean): Date {
    return businessHoursOnly ? this.addBusinessMinutes(start, minutes) : new Date(start.getTime() + minutes * 60000);
  }
  /**
   * Find matching SLA policy for a ticket based on project and priority
   */
  async getMatchingPolicy(organizationId: string, projectId: string, priority: Priority) {
    // 1. Try project-specific policy for this priority
    let policy = await prisma.slaPolicy.findFirst({
      where: {
        organizationId,
        projectId,
        priority,
      },
    });

    // 2. Fall back to organization-wide policy for this priority
    if (!policy) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          organizationId,
          projectId: null,
          priority,
        },
      });
    }

    return policy;
  }

  /**
   * Initialize SLA tracker for a newly created ticket
   */
  async initializeTrackerForTicket(ticketId: string, organizationId: string, projectId: string, priority: Priority) {
    const policy = await this.getMatchingPolicy(organizationId, projectId, priority);
    const now = new Date();

    const firstResponseMinutes = policy ? policy.firstResponseTargetMinutes : 60; // default 1 hour
    const resolutionMinutes = policy ? policy.resolutionTargetMinutes : 480; // default 8 hours

    const businessHoursOnly = policy?.isBusinessHoursOnly ?? true;
    const firstResponseDue = this.dueAt(now, firstResponseMinutes, businessHoursOnly);
    const resolutionDue = this.dueAt(now, resolutionMinutes, businessHoursOnly);

    return prisma.slaTracker.create({
      data: {
        ticketId,
        policyId: policy ? policy.id : null,
        status: SlaStatus.ON_TRACK,
        firstResponseDue,
        resolutionDue,
      },
      include: { policy: true },
    });
  }

  /**
   * Record agent response (marks first response complete)
   */
  async recordFirstResponse(ticketId: string) {
    const tracker = await prisma.slaTracker.findUnique({ where: { ticketId } });
    if (!tracker || tracker.firstResponseCompletedAt) return tracker;

    const now = new Date();
    const isBreached = tracker.firstResponseDue ? now > tracker.firstResponseDue : false;

    return prisma.slaTracker.update({
      where: { ticketId },
      data: {
        firstResponseCompletedAt: now,
        isFirstResponseBreached: isBreached,
      },
    });
  }

  /**
   * Handle ticket status changes (pause SLA on WAITING_FOR_CUSTOMER / PENDING, resume on IN_PROGRESS, complete on RESOLVED)
   */
  async handleStatusChange(ticketId: string, newStatus: TicketStatus) {
    const tracker = await prisma.slaTracker.findUnique({ where: { ticketId } });
    if (!tracker) return null;

    const now = new Date();

    // 1. Pausing SLA (when ticket is waiting for customer response or pending)
    if ((newStatus === TicketStatus.WAITING_FOR_CUSTOMER || newStatus === TicketStatus.PENDING) && !tracker.pausedAt) {
      return prisma.slaTracker.update({
        where: { ticketId },
        data: {
          pausedAt: now,
          status: SlaStatus.PAUSED,
        },
      });
    }

    // 2. Resuming SLA (when agent resumes work on ticket)
    if (newStatus === TicketStatus.IN_PROGRESS && tracker.pausedAt) {
      const pauseDurationMs = now.getTime() - tracker.pausedAt.getTime();
      const additionalPausedMinutes = Math.floor(pauseDurationMs / (1000 * 60));

      const updatedResolutionDue = tracker.resolutionDue
        ? new Date(tracker.resolutionDue.getTime() + pauseDurationMs)
        : null;

      const updatedFirstResponseDue = tracker.firstResponseDue && !tracker.firstResponseCompletedAt
        ? new Date(tracker.firstResponseDue.getTime() + pauseDurationMs)
        : tracker.firstResponseDue;

      return prisma.slaTracker.update({
        where: { ticketId },
        data: {
          pausedAt: null,
          totalPausedMinutes: tracker.totalPausedMinutes + additionalPausedMinutes,
          resolutionDue: updatedResolutionDue,
          firstResponseDue: updatedFirstResponseDue,
          status: SlaStatus.ON_TRACK,
        },
      });
    }

    // 3. Resolving ticket (marks resolution SLA completed)
    if ((newStatus === TicketStatus.RESOLVED || newStatus === TicketStatus.CLOSED) && !tracker.resolutionCompletedAt) {
      const isBreached = tracker.resolutionDue ? now > tracker.resolutionDue : false;

      return prisma.slaTracker.update({
        where: { ticketId },
        data: {
          resolutionCompletedAt: now,
          isResolutionBreached: isBreached,
          status: SlaStatus.COMPLETED,
        },
      });
    }

    return tracker;
  }

  /**
   * Recalculate status and check for breaches (can be run periodically or on-demand)
   */
  async updateSlaStatuses(organizationId: string) {
    const activeTrackers = await prisma.slaTracker.findMany({
      where: {
        ticket: { organizationId, status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
        status: { not: SlaStatus.PAUSED },
      },
      include: { policy: true },
    });

    const now = new Date();

    for (const tracker of activeTrackers) {
      let isBreached = false;
      let isWarning = false;

      if (tracker.resolutionDue && now > tracker.resolutionDue) {
        isBreached = true;
      } else if (tracker.resolutionDue) {
        const remainingMinutes = (tracker.resolutionDue.getTime() - now.getTime()) / (1000 * 60);
        if (remainingMinutes < 60) {
          isWarning = true;
        }
      }

      if (tracker.firstResponseDue && !tracker.firstResponseCompletedAt && now > tracker.firstResponseDue) {
        isBreached = true;
      }

      const newSlaStatus: SlaStatus = isBreached
        ? SlaStatus.BREACHED
        : isWarning
        ? SlaStatus.NEEDS_ATTENTION
        : SlaStatus.ON_TRACK;

      if (tracker.status !== newSlaStatus) {
        await prisma.slaTracker.update({
          where: { id: tracker.id },
          data: {
            status: newSlaStatus,
            isResolutionBreached: isBreached || tracker.isResolutionBreached,
          },
        });
      }
    }
  }
}
