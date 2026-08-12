CREATE TYPE "CapacityExceptionType" AS ENUM ('LEAVE', 'HOLIDAY', 'MEETING', 'SUPPORT', 'TRAINING', 'OTHER');
CREATE TYPE "PlanningSessionStatus" AS ENUM ('PREPARING', 'IN_PROGRESS', 'LOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WorkItemDependencyType" AS ENUM ('BLOCKS', 'DEPENDS_ON', 'RELATED');

ALTER TABLE "WorkItem" ADD COLUMN "sprintAddedAt" TIMESTAMP(3);

CREATE TABLE "ProjectPlanningHoliday" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "durationMinutes" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectPlanningHoliday_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SprintMemberCapacity" (
  "id" TEXT NOT NULL, "sprintId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "dailyCapacityMinutes" INTEGER NOT NULL DEFAULT 480, "focusPercent" INTEGER NOT NULL DEFAULT 75,
  "leaveMinutes" INTEGER NOT NULL DEFAULT 0, "meetingMinutes" INTEGER NOT NULL DEFAULT 0, "supportMinutes" INTEGER NOT NULL DEFAULT 0,
  "disciplineAllocations" JSONB, "skills" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SprintMemberCapacity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SprintCapacityException" (
  "id" TEXT NOT NULL, "sprintId" TEXT NOT NULL, "memberCapacityId" TEXT, "date" TIMESTAMP(3) NOT NULL,
  "type" "CapacityExceptionType" NOT NULL, "minutes" INTEGER NOT NULL, "description" TEXT, "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SprintCapacityException_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkItemPlanningEstimate" (
  "id" TEXT NOT NULL, "workItemId" TEXT NOT NULL, "optimisticMinutes" INTEGER NOT NULL, "mostLikelyMinutes" INTEGER NOT NULL,
  "pessimisticMinutes" INTEGER NOT NULL, "disciplineDemands" JSONB, "valueScore" INTEGER NOT NULL DEFAULT 50,
  "riskScore" INTEGER NOT NULL DEFAULT 30, "confidence" INTEGER NOT NULL DEFAULT 50, "refinementReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkItemPlanningEstimate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkItemDependency" (
  "id" TEXT NOT NULL, "sourceWorkItemId" TEXT NOT NULL, "targetWorkItemId" TEXT NOT NULL,
  "type" "WorkItemDependencyType" NOT NULL DEFAULT 'DEPENDS_ON', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkItemDependency_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SprintPlanningSession" (
  "id" TEXT NOT NULL, "sprintId" TEXT NOT NULL, "facilitatorId" TEXT NOT NULL, "status" "PlanningSessionStatus" NOT NULL DEFAULT 'PREPARING',
  "scenarioKey" TEXT, "goal" TEXT, "scopeHash" TEXT, "scopeSnapshot" JSONB, "capacitySnapshot" JSONB,
  "startedAt" TIMESTAMP(3), "lockedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SprintPlanningSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SprintPlanningEvent" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "actorId" TEXT, "type" TEXT NOT NULL, "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SprintPlanningEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SprintPlanningOutcome" (
  "id" TEXT NOT NULL, "sprintId" TEXT NOT NULL, "plannedPoints" INTEGER NOT NULL, "plannedMinutes" INTEGER NOT NULL,
  "completedPoints" INTEGER NOT NULL DEFAULT 0, "completedMinutes" INTEGER NOT NULL DEFAULT 0, "spilloverPoints" INTEGER NOT NULL DEFAULT 0,
  "unplannedPoints" INTEGER NOT NULL DEFAULT 0, "meetingDurationMinutes" INTEGER NOT NULL DEFAULT 0, "forecastConfidence" DOUBLE PRECISION,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SprintPlanningOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectPlanningHoliday_projectId_date_name_key" ON "ProjectPlanningHoliday"("projectId", "date", "name");
CREATE INDEX "ProjectPlanningHoliday_projectId_date_idx" ON "ProjectPlanningHoliday"("projectId", "date");
CREATE UNIQUE INDEX "SprintMemberCapacity_sprintId_userId_key" ON "SprintMemberCapacity"("sprintId", "userId");
CREATE INDEX "SprintMemberCapacity_userId_idx" ON "SprintMemberCapacity"("userId");
CREATE INDEX "SprintCapacityException_sprintId_date_idx" ON "SprintCapacityException"("sprintId", "date");
CREATE INDEX "SprintCapacityException_memberCapacityId_idx" ON "SprintCapacityException"("memberCapacityId");
CREATE UNIQUE INDEX "WorkItemPlanningEstimate_workItemId_key" ON "WorkItemPlanningEstimate"("workItemId");
CREATE UNIQUE INDEX "WorkItemDependency_sourceWorkItemId_targetWorkItemId_type_key" ON "WorkItemDependency"("sourceWorkItemId", "targetWorkItemId", "type");
CREATE INDEX "WorkItemDependency_targetWorkItemId_idx" ON "WorkItemDependency"("targetWorkItemId");
CREATE INDEX "SprintPlanningSession_sprintId_createdAt_idx" ON "SprintPlanningSession"("sprintId", "createdAt");
CREATE INDEX "SprintPlanningEvent_sessionId_createdAt_idx" ON "SprintPlanningEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX "SprintPlanningOutcome_sprintId_key" ON "SprintPlanningOutcome"("sprintId");

ALTER TABLE "ProjectPlanningHoliday" ADD CONSTRAINT "ProjectPlanningHoliday_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintMemberCapacity" ADD CONSTRAINT "SprintMemberCapacity_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintMemberCapacity" ADD CONSTRAINT "SprintMemberCapacity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintCapacityException" ADD CONSTRAINT "SprintCapacityException_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintCapacityException" ADD CONSTRAINT "SprintCapacityException_memberCapacityId_fkey" FOREIGN KEY ("memberCapacityId") REFERENCES "SprintMemberCapacity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItemPlanningEstimate" ADD CONSTRAINT "WorkItemPlanningEstimate_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItemDependency" ADD CONSTRAINT "WorkItemDependency_sourceWorkItemId_fkey" FOREIGN KEY ("sourceWorkItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItemDependency" ADD CONSTRAINT "WorkItemDependency_targetWorkItemId_fkey" FOREIGN KEY ("targetWorkItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintPlanningSession" ADD CONSTRAINT "SprintPlanningSession_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintPlanningSession" ADD CONSTRAINT "SprintPlanningSession_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SprintPlanningEvent" ADD CONSTRAINT "SprintPlanningEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SprintPlanningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintPlanningEvent" ADD CONSTRAINT "SprintPlanningEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SprintPlanningOutcome" ADD CONSTRAINT "SprintPlanningOutcome_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
