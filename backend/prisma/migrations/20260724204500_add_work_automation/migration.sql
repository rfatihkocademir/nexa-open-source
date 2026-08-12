CREATE TYPE "WorkAutomationTrigger" AS ENUM ('WORK_ITEM_CREATED', 'WORK_ITEM_UPDATED', 'STATUS_CHANGED', 'SPRINT_STARTED', 'SPRINT_COMPLETED', 'SCHEDULED', 'MANUAL');
CREATE TYPE "WorkAutomationRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "WorkAutomationExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'SKIPPED', 'FAILED');

CREATE TABLE "WorkAutomationRule" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "trigger" "WorkAutomationTrigger" NOT NULL,
  "nqlCondition" TEXT,
  "actions" JSONB NOT NULL,
  "status" "WorkAutomationRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "executionCount" INTEGER NOT NULL DEFAULT 0,
  "lastExecutedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkAutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkAutomationExecution" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "workItemId" TEXT,
  "trigger" "WorkAutomationTrigger" NOT NULL,
  "status" "WorkAutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "actionResults" JSONB,
  "error" TEXT,
  "durationMs" INTEGER,
  "idempotencyKey" TEXT NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkAutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkAutomationRule_projectId_status_trigger_idx" ON "WorkAutomationRule"("projectId", "status", "trigger");
CREATE UNIQUE INDEX "WorkAutomationExecution_idempotencyKey_key" ON "WorkAutomationExecution"("idempotencyKey");
CREATE INDEX "WorkAutomationExecution_projectId_createdAt_idx" ON "WorkAutomationExecution"("projectId", "createdAt");
CREATE INDEX "WorkAutomationExecution_ruleId_createdAt_idx" ON "WorkAutomationExecution"("ruleId", "createdAt");
CREATE INDEX "WorkAutomationExecution_workItemId_idx" ON "WorkAutomationExecution"("workItemId");

ALTER TABLE "WorkAutomationRule" ADD CONSTRAINT "WorkAutomationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAutomationRule" ADD CONSTRAINT "WorkAutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkAutomationExecution" ADD CONSTRAINT "WorkAutomationExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAutomationExecution" ADD CONSTRAINT "WorkAutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkAutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
