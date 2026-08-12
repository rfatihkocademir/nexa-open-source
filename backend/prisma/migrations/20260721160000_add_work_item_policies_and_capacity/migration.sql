ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'OPERATIONAL';
ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'MEETING';
ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'PRESENTATION';
ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'ADMINISTRATIVE';

CREATE TYPE "WorklogCategory" AS ENUM ('DEVELOPMENT', 'TESTING', 'ANALYSIS', 'OPERATIONS', 'MEETING', 'PRESENTATION', 'SUPPORT', 'DOCUMENTATION', 'ADMINISTRATIVE');

ALTER TABLE "ProjectMember" ADD COLUMN "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 2400;
ALTER TABLE "WorkItem" ADD COLUMN "customFields" JSONB;
ALTER TABLE "Worklog" ADD COLUMN "category" "WorklogCategory" NOT NULL DEFAULT 'DEVELOPMENT';
ALTER TABLE "Worklog" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WorkItemPolicy" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "itemType" "WorkItemType" NOT NULL,
  "requiresTestsForDone" BOOLEAN NOT NULL DEFAULT false,
  "requiresPassingTest" BOOLEAN NOT NULL DEFAULT false,
  "requiresWorklogForDone" BOOLEAN NOT NULL DEFAULT false,
  "minimumLoggedMinutes" INTEGER NOT NULL DEFAULT 0,
  "requiredFields" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkItemPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkItemPolicy_projectId_itemType_key" ON "WorkItemPolicy"("projectId", "itemType");
CREATE INDEX "WorkItemPolicy_projectId_idx" ON "WorkItemPolicy"("projectId");
ALTER TABLE "WorkItemPolicy" ADD CONSTRAINT "WorkItemPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
