import prisma from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { ProjectAccess } from "../utils/projectAccess";
import { createHash } from "node:crypto";
import type {
  CapacityExceptionType,
  PlanningSessionStatus,
  Prisma,
  WorkItemDependencyType,
} from "@prisma/client";

const productiveCategories = new Set([
  "DEVELOPMENT",
  "TESTING",
  "ANALYSIS",
  "OPERATIONS",
]);
const closedStatuses = new Set(["DONE", "CLOSED"]);
const developmentTypes = new Set(["STORY", "TASK", "BUG", "DEFECT"]);
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

function weekdaysBetween(start: Date, end: Date) {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);
  while (cursor <= finish) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, count);
}

function quantile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

type Allocation = { discipline: string; percent: number };
type Demand = { discipline: string; minutes: number; skill?: string };
const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];
const int = (value: unknown, fallback: number, min = 0, max = 100000) =>
  clamp(Math.round(Number(value) || fallback), min, max);

function seededRandom(seed: string) {
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function triangular(
  random: () => number,
  low: number,
  mode: number,
  high: number,
) {
  if (high <= low) return low;
  const u = random();
  const split = (mode - low) / (high - low);
  return u < split
    ? low + Math.sqrt(u * (high - low) * (mode - low))
    : high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}

function isWeekday(date: Date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

export class SprintPlanningService {
  private async sprintAccess(sprintId: string, userId: string, role: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        status: true,
        goal: true,
        workItems: {
          where: { deletedAt: null, itemType: { not: "EPIC" } },
          select: { id: true, key: true, storyPoints: true },
        },
      },
    });
    if (!sprint) throw new AppError("Sprint not found", 404);
    await ProjectAccess.check(sprint.projectId, userId, role);
    return sprint;
  }

  private assertEditable(sprint: { status: string }) {
    if (sprint.status === "CLOSED")
      throw new AppError("Closed sprint planning data is read-only", 409);
  }

  async saveMemberCapacity(
    sprintId: string,
    memberUserId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: sprint.projectId, userId: memberUserId },
    });
    if (!membership) throw new AppError("User is not a project member", 400);
    const allocations = asArray<Allocation>(input.disciplineAllocations).map(
      (row) => ({
        discipline: String(row.discipline || "GENERAL").toUpperCase(),
        percent: int(row.percent, 0, 0, 100),
      }),
    );
    if (
      allocations.length &&
      allocations.reduce((sum, row) => sum + row.percent, 0) !== 100
    )
      throw new AppError("Discipline allocations must total 100%", 400);
    return prisma.sprintMemberCapacity.upsert({
      where: { sprintId_userId: { sprintId, userId: memberUserId } },
      create: {
        sprintId,
        userId: memberUserId,
        dailyCapacityMinutes: int(input.dailyCapacityMinutes, 480, 60, 1440),
        focusPercent: int(input.focusPercent, 75, 10, 100),
        leaveMinutes: int(input.leaveMinutes, 0),
        meetingMinutes: int(input.meetingMinutes, 0),
        supportMinutes: int(input.supportMinutes, 0),
        disciplineAllocations: allocations as unknown as Prisma.InputJsonValue,
        skills: asArray(input.skills) as Prisma.InputJsonValue,
      },
      update: {
        dailyCapacityMinutes: int(input.dailyCapacityMinutes, 480, 60, 1440),
        focusPercent: int(input.focusPercent, 75, 10, 100),
        leaveMinutes: int(input.leaveMinutes, 0),
        meetingMinutes: int(input.meetingMinutes, 0),
        supportMinutes: int(input.supportMinutes, 0),
        disciplineAllocations: allocations as unknown as Prisma.InputJsonValue,
        skills: asArray(input.skills) as Prisma.InputJsonValue,
      },
    });
  }

  async addException(
    sprintId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const memberCapacityId = input.memberCapacityId
      ? String(input.memberCapacityId)
      : null;
    if (
      memberCapacityId &&
      !(await prisma.sprintMemberCapacity.findFirst({
        where: { id: memberCapacityId, sprintId },
      }))
    )
      throw new AppError("Capacity member does not belong to sprint", 400);
    const date = new Date(String(input.date));
    if (Number.isNaN(date.getTime()))
      throw new AppError("Valid date is required", 400);
    const allowed = new Set([
      "LEAVE",
      "HOLIDAY",
      "MEETING",
      "SUPPORT",
      "TRAINING",
      "OTHER",
    ]);
    const type = String(input.type || "OTHER").toUpperCase();
    if (!allowed.has(type)) throw new AppError("Invalid exception type", 400);
    return prisma.sprintCapacityException.create({
      data: {
        sprintId,
        memberCapacityId,
        date,
        type: type as CapacityExceptionType,
        minutes: int(input.minutes, 0, 1, 1440),
        description: input.description ? String(input.description) : null,
        source: input.source ? String(input.source) : "MANUAL",
      },
    });
  }

  async addHoliday(
    sprintId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const date = new Date(String(input.date));
    if (Number.isNaN(date.getTime()) || !input.name)
      throw new AppError("Holiday name and valid date are required", 400);
    return prisma.projectPlanningHoliday.upsert({
      where: {
        projectId_date_name: {
          projectId: sprint.projectId,
          date,
          name: String(input.name),
        },
      },
      create: {
        projectId: sprint.projectId,
        date,
        name: String(input.name),
        durationMinutes:
          input.durationMinutes == null
            ? null
            : int(input.durationMinutes, 480, 1, 1440),
      },
      update: {
        durationMinutes:
          input.durationMinutes == null
            ? null
            : int(input.durationMinutes, 480, 1, 1440),
      },
    });
  }

  async deleteException(
    sprintId: string,
    exceptionId: string,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const result = await prisma.sprintCapacityException.deleteMany({
      where: { id: exceptionId, sprintId },
    });
    if (!result.count) throw new AppError("Capacity exception not found", 404);
    return { success: true };
  }

  async deleteHoliday(
    sprintId: string,
    holidayId: string,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const result = await prisma.projectPlanningHoliday.deleteMany({
      where: { id: holidayId, projectId: sprint.projectId },
    });
    if (!result.count) throw new AppError("Planning holiday not found", 404);
    return { success: true };
  }

  async saveEstimate(
    sprintId: string,
    workItemId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, projectId: sprint.projectId, deletedAt: null },
    });
    if (!workItem) throw new AppError("Work item not found in project", 404);
    const optimistic = int(input.optimisticMinutes, 0, 1);
    const likely = int(input.mostLikelyMinutes, 0, optimistic);
    const pessimistic = int(input.pessimisticMinutes, 0, likely);
    const values = {
      optimisticMinutes: optimistic,
      mostLikelyMinutes: likely,
      pessimisticMinutes: pessimistic,
      disciplineDemands: asArray(
        input.disciplineDemands,
      ) as Prisma.InputJsonValue,
      valueScore: int(input.valueScore, 50, 0, 100),
      riskScore: int(input.riskScore, 30, 0, 100),
      confidence: int(input.confidence, 50, 0, 100),
      refinementReady: Boolean(input.refinementReady),
    };
    return prisma.workItemPlanningEstimate.upsert({
      where: { workItemId },
      create: { workItemId, ...values },
      update: values,
    });
  }

  async addDependency(
    sprintId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const sourceWorkItemId = String(input.sourceWorkItemId);
    const targetWorkItemId = String(input.targetWorkItemId);
    if (sourceWorkItemId === targetWorkItemId)
      throw new AppError("A work item cannot depend on itself", 400);
    const count = await prisma.workItem.count({
      where: {
        id: { in: [sourceWorkItemId, targetWorkItemId] },
        projectId: sprint.projectId,
        deletedAt: null,
      },
    });
    if (count !== 2)
      throw new AppError("Dependency items must belong to project", 400);
    const type = String(
      input.type || "DEPENDS_ON",
    ).toUpperCase() as WorkItemDependencyType;
    if (!["BLOCKS", "DEPENDS_ON", "RELATED"].includes(type))
      throw new AppError("Invalid dependency type", 400);
    if (type !== "RELATED") {
      const dependencies = await prisma.workItemDependency.findMany({
        where: {
          sourceWorkItem: { projectId: sprint.projectId },
          type: { not: "RELATED" },
        },
        select: { sourceWorkItemId: true, targetWorkItemId: true },
      });
      const graph = new Map<string, string[]>();
      for (const edge of [
        ...dependencies,
        { sourceWorkItemId, targetWorkItemId },
      ])
        graph.set(edge.sourceWorkItemId, [
          ...(graph.get(edge.sourceWorkItemId) ?? []),
          edge.targetWorkItemId,
        ]);
      const visit = (
        node: string,
        visiting = new Set<string>(),
        visited = new Set<string>(),
      ): boolean => {
        if (visiting.has(node)) return true;
        if (visited.has(node)) return false;
        visiting.add(node);
        for (const next of graph.get(node) ?? [])
          if (visit(next, visiting, visited)) return true;
        visiting.delete(node);
        visited.add(node);
        return false;
      };
      if ([...graph.keys()].some((node) => visit(node)))
        throw new AppError("Dependency would create a cycle", 409);
    }
    return prisma.workItemDependency.upsert({
      where: {
        sourceWorkItemId_targetWorkItemId_type: {
          sourceWorkItemId,
          targetWorkItemId,
          type,
        },
      },
      create: { sourceWorkItemId, targetWorkItemId, type },
      update: {},
    });
  }

  async deleteDependency(
    sprintId: string,
    dependencyId: string,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const result = await prisma.workItemDependency.deleteMany({
      where: {
        id: dependencyId,
        sourceWorkItem: { projectId: sprint.projectId },
      },
    });
    if (!result.count)
      throw new AppError("Work item dependency not found", 404);
    return { success: true };
  }

  async createSession(
    sprintId: string,
    input: Record<string, unknown>,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const existing = await prisma.sprintPlanningSession.findFirst({
      where: { sprintId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    });
    if (existing) return existing;
    const report = await this.report(sprintId, userId, role);
    const created = await prisma.sprintPlanningSession.create({
      data: {
        sprintId,
        facilitatorId: userId,
        goal: input.goal ? String(input.goal) : sprint.goal,
        status: "PREPARING",
        events: {
          create: {
            actorId: userId,
            type: "SESSION_CREATED",
            payload: {
              readinessScore: report.summary.readinessScore,
              blockers: report.blockers,
            },
          },
        },
      },
      include: { events: true },
    });
    const members = await prisma.projectMember.findMany({
      where: { projectId: sprint.projectId },
      select: { userId: true },
    });
    if (members.length)
      await prisma.notification.createMany({
        data: members.map((member) => ({
          userId: member.userId,
          title: "Sprint planlama hazırlığı",
          message: report.blockers.length
            ? `${report.blockers.length} hazırlık eksiği var. Toplantıdan önce kontrol edin.`
            : "Sprint planı toplantıya hazır.",
          type: report.blockers.length ? "WARNING" : "INFO",
          data: {
            sprintId,
            sessionId: created.id,
            readinessScore: report.summary.readinessScore,
          },
        })),
      });
    return created;
  }

  async transitionSession(
    sprintId: string,
    sessionId: string,
    statusValue: unknown,
    userId: string,
    role: string,
  ) {
    const sprint = await this.sprintAccess(sprintId, userId, role);
    this.assertEditable(sprint);
    const status = String(statusValue).toUpperCase() as PlanningSessionStatus;
    const session = await prisma.sprintPlanningSession.findFirst({
      where: { id: sessionId, sprintId },
    });
    if (!session) throw new AppError("Planning session not found", 404);
    const transitions: Record<string, string[]> = {
      PREPARING: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["LOCKED", "CANCELLED"],
      LOCKED: ["IN_PROGRESS", "COMPLETED"],
    };
    if (!transitions[session.status]?.includes(status))
      throw new AppError(
        `Invalid planning session transition: ${session.status} -> ${status}`,
        409,
      );
    const now = new Date();
    const scope = sprint.workItems
      .map((item) => ({
        id: item.id,
        key: item.key,
        storyPoints: item.storyPoints,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const scopeHash = createHash("sha256")
      .update(JSON.stringify(scope))
      .digest("hex");
    const report = await this.report(sprintId, userId, role);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.sprintPlanningSession.update({
        where: { id: sessionId },
        data: {
          status,
          startedAt:
            status === "IN_PROGRESS" && !session.startedAt ? now : undefined,
          lockedAt: status === "LOCKED" ? now : undefined,
          completedAt: status === "COMPLETED" ? now : undefined,
          scopeHash: ["LOCKED", "COMPLETED"].includes(status)
            ? scopeHash
            : undefined,
          scopeSnapshot: ["LOCKED", "COMPLETED"].includes(status)
            ? (scope as unknown as Prisma.InputJsonValue)
            : undefined,
          capacitySnapshot: ["LOCKED", "COMPLETED"].includes(status)
            ? (report.summary as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
      await tx.sprintPlanningEvent.create({
        data: {
          sessionId,
          actorId: userId,
          type: `SESSION_${status}`,
          payload: { scopeHash },
        },
      });
      if (status === "COMPLETED")
        await tx.sprintPlanningOutcome.upsert({
          where: { sprintId },
          create: {
            sprintId,
            plannedPoints: report.summary.totalPoints,
            plannedMinutes: report.summary.teamNetMinutes,
            meetingDurationMinutes: session.startedAt
              ? Math.round(
                  (now.getTime() - session.startedAt.getTime()) / 60000,
                )
              : 0,
            forecastConfidence: report.summary.forecastConfidence,
          },
          update: {
            plannedPoints: report.summary.totalPoints,
            plannedMinutes: report.summary.teamNetMinutes,
            meetingDurationMinutes: session.startedAt
              ? Math.round(
                  (now.getTime() - session.startedAt.getTime()) / 60000,
                )
              : 0,
            forecastConfidence: report.summary.forecastConfidence,
            calculatedAt: now,
          },
        });
      return updated;
    });
  }

  async report(sprintId: string, userId: string, role: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: { select: { id: true, name: true } },
        workItems: {
          where: { deletedAt: null },
          include: {
            planningEstimate: true,
            outgoingDependencies: true,
            testCases: { select: { id: true } },
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!sprint) throw new AppError("Sprint not found", 404);
    await ProjectAccess.check(sprint.projectId, userId, role);
    const start = sprint.startDate ?? new Date();
    const end = sprint.endDate ?? new Date(start.getTime() + 13 * 86400000);
    const workingDays = weekdaysBetween(start, end);
    const historyStart = new Date(start);
    historyStart.setDate(historyStart.getDate() - 56);
    const [
      members,
      logs,
      completedSprints,
      backlog,
      savedCapacities,
      exceptions,
      holidays,
      activeSession,
      previousOutcomes,
    ] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId: sprint.projectId },
        select: {
          userId: true,
          weeklyCapacityMinutes: true,
          user: { select: { firstName: true, lastName: true, role: true } },
        },
      }),
      prisma.worklog.findMany({
        where: {
          projectId: sprint.projectId,
          deletedAt: null,
          startedAt: { gte: historyStart, lt: start },
        },
        select: { userId: true, durationMinutes: true, category: true },
      }),
      prisma.sprint.findMany({
        where: {
          projectId: sprint.projectId,
          status: "CLOSED",
          id: { not: sprint.id },
        },
        orderBy: { endDate: "desc" },
        take: 12,
        include: {
          workItems: {
            where: { deletedAt: null, status: { in: ["DONE", "CLOSED"] } },
            select: { storyPoints: true },
          },
        },
      }),
      prisma.workItem.findMany({
        where: {
          projectId: sprint.projectId,
          sprintId: null,
          deletedAt: null,
          itemType: { not: "EPIC" },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: {
          planningEstimate: true,
          outgoingDependencies: true,
          testCases: { select: { id: true } },
        },
        take: 100,
      }),
      prisma.sprintMemberCapacity.findMany({
        where: { sprintId },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
        },
      }),
      prisma.sprintCapacityException.findMany({
        where: { sprintId, date: { gte: start, lte: end } },
      }),
      prisma.projectPlanningHoliday.findMany({
        where: { projectId: sprint.projectId, date: { gte: start, lte: end } },
      }),
      prisma.sprintPlanningSession.findFirst({
        where: { sprintId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        include: { events: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.sprintPlanningOutcome.findMany({
        where: { sprint: { projectId: sprint.projectId } },
        orderBy: { calculatedAt: "desc" },
        take: 12,
      }),
    ]);

    const totalPoints = sprint.workItems.reduce(
      (sum, item) => sum + (item.storyPoints ?? 0),
      0,
    );
    const capacityPoints =
      sprint.capacityPoints ??
      Math.max(
        1,
        Math.round(
          quantile(
            completedSprints.map((item) =>
              item.workItems.reduce(
                (sum, work) => sum + (work.storyPoints ?? 0),
                0,
              ),
            ),
            0.5,
          ) ||
            totalPoints ||
            1,
        ),
      );
    const holidayMinutes = holidays
      .filter((holiday) => isWeekday(holiday.date))
      .reduce((sum, holiday) => sum + (holiday.durationMinutes ?? 480), 0);
    const memberRows = members.map((member) => {
      const memberLogs = logs.filter((log) => log.userId === member.userId);
      const logged = memberLogs.reduce(
        (sum, log) => sum + log.durationMinutes,
        0,
      );
      const productive = memberLogs
        .filter((log) => productiveCategories.has(log.category))
        .reduce((sum, log) => sum + log.durationMinutes, 0);
      const focusFactor = logged ? clamp(productive / logged, 0.55, 0.9) : 0.75;
      const saved = savedCapacities.find((row) => row.userId === member.userId);
      const grossMinutes = saved
        ? saved.dailyCapacityMinutes * workingDays
        : (member.weeklyCapacityMinutes / 5) * workingDays;
      const datedDeductions = exceptions
        .filter(
          (row) => !row.memberCapacityId || row.memberCapacityId === saved?.id,
        )
        .reduce((sum, row) => sum + row.minutes, 0);
      const fixedDeductions =
        (saved?.leaveMinutes ?? 0) +
        (saved?.meetingMinutes ?? 0) +
        (saved?.supportMinutes ?? 0) +
        holidayMinutes;
      const effectiveFocus = saved ? saved.focusPercent / 100 : focusFactor;
      const netMinutes = Math.max(
        0,
        Math.round(
          (grossMinutes - fixedDeductions - datedDeductions) * effectiveFocus,
        ),
      );
      const assignedItems = sprint.workItems.filter(
        (item) => item.assigneeId === member.userId,
      );
      const assignedPoints = assignedItems.reduce(
        (sum, item) => sum + (item.storyPoints ?? 0),
        0,
      );
      const allocations = asArray<Allocation>(
        saved?.disciplineAllocations,
      ).filter((row) => row.discipline && row.percent > 0);
      return {
        userId: member.userId,
        name: `${member.user.firstName} ${member.user.lastName}`.trim(),
        role: member.user.role,
        grossMinutes: Math.round(grossMinutes),
        netMinutes,
        focusFactor: round(effectiveFocus * 100),
        deductions: fixedDeductions + datedDeductions,
        dailyCapacityMinutes:
          saved?.dailyCapacityMinutes ??
          Math.round(member.weeklyCapacityMinutes / 5),
        leaveMinutes: saved?.leaveMinutes ?? 0,
        meetingMinutes: saved?.meetingMinutes ?? 0,
        supportMinutes: saved?.supportMinutes ?? 0,
        disciplineAllocations: allocations,
        skills: asArray(saved?.skills),
        assignedItems: assignedItems.length,
        assignedPoints,
        pointBudget: 0,
        utilization: 0,
      };
    });
    const teamNetMinutes = memberRows.reduce(
      (sum, member) => sum + member.netMinutes,
      0,
    );
    memberRows.forEach((member) => {
      member.pointBudget = round(
        capacityPoints * (member.netMinutes / Math.max(1, teamNetMinutes)),
      );
      member.utilization = round(
        (member.assignedPoints / Math.max(0.1, member.pointBudget)) * 100,
      );
    });

    const items = sprint.workItems.filter((item) => item.itemType !== "EPIC");
    const ratio = (predicate: (item: (typeof items)[number]) => boolean) =>
      items.length ? items.filter(predicate).length / items.length : 0;
    const dimensions = {
      goal: sprint.goal?.trim() ? 100 : 0,
      capacity: sprint.capacityPoints ? 100 : 50,
      estimated: round(ratio((item) => (item.storyPoints ?? 0) > 0) * 100),
      assigned: round(ratio((item) => Boolean(item.assigneeId)) * 100),
      acceptance: round(
        ratio(
          (item) =>
            !developmentTypes.has(item.itemType) ||
            Boolean(item.acceptanceCriteria?.trim()),
        ) * 100,
      ),
      testable: round(
        ratio(
          (item) =>
            !developmentTypes.has(item.itemType) || item.testCases.length > 0,
        ) * 100,
      ),
    };
    const readinessScore = round(
      dimensions.goal * 0.15 +
        dimensions.capacity * 0.1 +
        dimensions.estimated * 0.2 +
        dimensions.assigned * 0.15 +
        dimensions.acceptance * 0.2 +
        dimensions.testable * 0.2,
      0,
    );
    const blockers: string[] = [];
    if (!sprint.goal?.trim()) blockers.push("Sprint Goal tanımlanmamış.");
    if (!items.length) blockers.push("Sprint kapsamında iş bulunmuyor.");
    if (dimensions.estimated < 100)
      blockers.push(
        `${items.filter((item) => !item.storyPoints).length} işin story point tahmini eksik.`,
      );
    if (dimensions.acceptance < 100)
      blockers.push(
        `${items.filter((item) => developmentTypes.has(item.itemType) && !item.acceptanceCriteria?.trim()).length} geliştirme işinin kabul kriteri eksik.`,
      );
    if (memberRows.some((member) => member.utilization > 110))
      blockers.push(
        "En az bir ekip üyesinin planlanan yükü kapasitesinin %110 üzerinde.",
      );

    const disciplineCapacity: Record<string, number> = {};
    const skillCoverage: Record<string, number> = {};
    for (const member of memberRows) {
      const allocations = member.disciplineAllocations.length
        ? member.disciplineAllocations
        : [{ discipline: "GENERAL", percent: 100 }];
      for (const allocation of allocations)
        disciplineCapacity[allocation.discipline] =
          (disciplineCapacity[allocation.discipline] ?? 0) +
          Math.round((member.netMinutes * allocation.percent) / 100);
      for (const skill of member.skills) {
        const name =
          typeof skill === "string"
            ? skill
            : String((skill as { name?: unknown }).name ?? "");
        if (name.trim())
          skillCoverage[name.trim().toLocaleLowerCase()] =
            (skillCoverage[name.trim().toLocaleLowerCase()] ?? 0) + 1;
      }
    }
    const disciplineDemand: Record<string, number> = {};
    const requiredSkills = new Set<string>();
    for (const item of items)
      for (const demand of asArray<Demand>(
        item.planningEstimate?.disciplineDemands,
      )) {
        disciplineDemand[demand.discipline] =
          (disciplineDemand[demand.discipline] ?? 0) + demand.minutes;
        if (demand.skill?.trim())
          requiredSkills.add(demand.skill.trim().toLocaleLowerCase());
      }
    const skillGaps = [...requiredSkills]
      .filter((skill) => !skillCoverage[skill])
      .map((skill) => ({
        skill,
        requiredBy: items
          .filter((item) =>
            asArray<Demand>(item.planningEstimate?.disciplineDemands).some(
              (demand) => demand.skill?.trim().toLocaleLowerCase() === skill,
            ),
          )
          .map((item) => item.key),
      }));
    const disciplineBottlenecks = Object.entries(disciplineDemand)
      .map(([discipline, demandMinutes]) => ({
        discipline,
        demandMinutes,
        capacityMinutes:
          disciplineCapacity[discipline] ?? disciplineCapacity.GENERAL ?? 0,
        utilization: round(
          (demandMinutes /
            Math.max(
              1,
              disciplineCapacity[discipline] ?? disciplineCapacity.GENERAL ?? 0,
            )) *
            100,
        ),
      }))
      .filter((row) => row.utilization > 100)
      .sort((a, b) => b.utilization - a.utilization);

    const throughput = completedSprints
      .map((item) =>
        item.workItems.reduce((sum, work) => sum + (work.storyPoints ?? 0), 0),
      )
      .filter((value) => value > 0);
    const fallback = capacityPoints;
    const historicalUnplannedRatio = previousOutcomes.length
      ? previousOutcomes.reduce(
          (sum, row) =>
            sum + row.unplannedPoints / Math.max(1, row.plannedPoints),
          0,
        ) / previousOutcomes.length
      : 0.15;
    const unplannedBufferPercent = round(
      clamp(historicalUnplannedRatio * 100, 10, 35),
      0,
    );
    const scenarioDefs = [
      { key: "SAFE", confidence: 90, multiplier: 0.75 },
      { key: "BALANCED", confidence: 85, multiplier: 0.88 },
      { key: "AGGRESSIVE", confidence: 70, multiplier: 1 },
    ];
    const scenarios = scenarioDefs.map((definition) => {
      const pointLimit = Math.max(
        1,
        Math.floor(
          fallback * definition.multiplier * (1 - unplannedBufferPercent / 100),
        ),
      );
      const recommended: typeof backlog = [];
      let points = 0;
      const ranked = [...backlog].sort(
        (a, b) =>
          ((b.planningEstimate?.valueScore ?? 50) *
            (b.planningEstimate?.confidence ?? 50)) /
            Math.max(1, b.planningEstimate?.riskScore ?? 30) -
          ((a.planningEstimate?.valueScore ?? 50) *
            (a.planningEstimate?.confidence ?? 50)) /
            Math.max(1, a.planningEstimate?.riskScore ?? 30),
      );
      for (const item of ranked) {
        const value = item.storyPoints ?? 0;
        if (!value || points + value > pointLimit) continue;
        const unresolved = item.outgoingDependencies.some(
          (dependency) =>
            !recommended.some(
              (selected) => selected.id === dependency.targetWorkItemId,
            ),
        );
        if (unresolved) continue;
        recommended.push(item);
        points += value;
      }
      const random = seededRandom(`${sprint.id}:${definition.key}`);
      let successes = 0;
      const simulations = 5000;
      for (let run = 0; run < simulations; run += 1) {
        const capacitySample = Math.max(
          1,
          triangular(
            random,
            teamNetMinutes * 0.75,
            teamNetMinutes * 0.92,
            teamNetMinutes,
          ),
        );
        const duration = recommended.reduce((sum, item) => {
          const estimate = item.planningEstimate;
          const likely =
            estimate?.mostLikelyMinutes ?? (item.storyPoints ?? 1) * 360;
          return (
            sum +
            triangular(
              random,
              estimate?.optimisticMinutes ?? likely * 0.7,
              likely,
              estimate?.pessimisticMinutes ?? likely * 1.6,
            )
          );
        }, 0);
        if (duration <= capacitySample * (1 - unplannedBufferPercent / 100))
          successes += 1;
      }
      return {
        key: definition.key,
        confidence: round((successes / simulations) * 100, 0),
        targetConfidence: definition.confidence,
        pointLimit,
        recommendedPoints: points,
        recommendedItems: recommended.map((item) => ({
          id: item.id,
          key: item.key,
          title: item.title,
          storyPoints: item.storyPoints,
          priority: item.priority,
        })),
        historicalSamples: throughput.length,
        simulations,
      };
    });
    const planningItems = [...items, ...backlog].map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      storyPoints: item.storyPoints,
      inSprint: item.sprintId === sprint.id,
      estimate: item.planningEstimate,
      dependencies: item.outgoingDependencies,
    }));
    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        status: sprint.status,
        goal: sprint.goal,
        startDate: start,
        endDate: end,
        workingDays,
        capacityPoints,
        capacitySource: sprint.capacityPoints
          ? "MANUAL"
          : throughput.length
            ? "HISTORICAL"
            : "CURRENT_SCOPE",
      },
      summary: {
        readinessScore,
        totalPoints,
        capacityPoints,
        pointUtilization: round((totalPoints / capacityPoints) * 100),
        teamGrossMinutes: memberRows.reduce(
          (sum, member) => sum + member.grossMinutes,
          0,
        ),
        teamNetMinutes,
        focusReserveMinutes: memberRows.reduce(
          (sum, member) => sum + member.grossMinutes - member.netMinutes,
          0,
        ),
        forecastConfidence:
          scenarios.find((row) => row.key === "BALANCED")?.confidence ?? null,
        unplannedBufferPercent,
      },
      dimensions,
      blockers,
      members: memberRows,
      holidays,
      exceptions,
      planningItems,
      disciplineCapacity,
      disciplineDemand,
      disciplineBottlenecks,
      skillCoverage,
      skillGaps,
      bottlenecks: memberRows
        .filter((member) => member.utilization > 100)
        .sort((a, b) => b.utilization - a.utilization),
      scenarios,
      activeSession,
      outcome: previousOutcomes.find((row) => row.sprintId === sprint.id) ?? null,
      calibration: previousOutcomes,
    };
  }
}

export const sprintPlanningService = new SprintPlanningService();
