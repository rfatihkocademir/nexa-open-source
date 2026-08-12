CREATE TYPE "DashboardScope" AS ENUM ('PERSONAL', 'PROJECT', 'ORGANIZATION');
CREATE TYPE "DashboardWidgetType" AS ENUM ('KPI_WORK_ITEMS', 'KPI_CRITICAL_BUGS', 'KPI_PASS_RATE', 'KPI_RELEASE_READINESS', 'STATUS_DISTRIBUTION', 'EXECUTION_TREND', 'MY_WORK', 'RISK_ACTIONS', 'PORTFOLIO_HEALTH');
CREATE TYPE "ActionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

CREATE TABLE "DashboardDefinition" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT, "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "scope" "DashboardScope" NOT NULL DEFAULT 'PERSONAL',
  "isDefault" BOOLEAN NOT NULL DEFAULT false, "layoutVersion" INTEGER NOT NULL DEFAULT 1, "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  CONSTRAINT "DashboardDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DashboardWidget" (
  "id" TEXT NOT NULL, "dashboardId" TEXT NOT NULL, "type" "DashboardWidgetType" NOT NULL, "title" TEXT NOT NULL,
  "positionX" INTEGER NOT NULL DEFAULT 0, "positionY" INTEGER NOT NULL DEFAULT 0, "width" INTEGER NOT NULL DEFAULT 4,
  "height" INTEGER NOT NULL DEFAULT 3, "config" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DashboardPreference" (
  "userId" TEXT NOT NULL, "dashboardId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "ActionCenterItem" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT, "assigneeId" TEXT, "createdById" TEXT, "resolvedById" TEXT,
  "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "actionType" TEXT NOT NULL, "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "severity" "ActionSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN', "dueDate" TIMESTAMP(3), "snoozedUntil" TIMESTAMP(3),
  "actionUrl" TEXT, "metadata" JSONB, "resolution" TEXT, "resolvedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ActionCenterItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardDefinition_organizationId_scope_deletedAt_idx" ON "DashboardDefinition"("organizationId", "scope", "deletedAt");
CREATE INDEX "DashboardDefinition_ownerId_isDefault_idx" ON "DashboardDefinition"("ownerId", "isDefault");
CREATE INDEX "DashboardDefinition_projectId_idx" ON "DashboardDefinition"("projectId");
CREATE INDEX "DashboardWidget_dashboardId_positionY_positionX_idx" ON "DashboardWidget"("dashboardId", "positionY", "positionX");
CREATE INDEX "DashboardPreference_dashboardId_idx" ON "DashboardPreference"("dashboardId");
CREATE UNIQUE INDEX "ActionCenterItem_organizationId_dedupeKey_key" ON "ActionCenterItem"("organizationId", "dedupeKey");
CREATE INDEX "ActionCenterItem_organizationId_status_severity_idx" ON "ActionCenterItem"("organizationId", "status", "severity");
CREATE INDEX "ActionCenterItem_assigneeId_status_idx" ON "ActionCenterItem"("assigneeId", "status");
CREATE INDEX "ActionCenterItem_projectId_status_idx" ON "ActionCenterItem"("projectId", "status");
CREATE UNIQUE INDEX "DashboardDefinition_personal_default_key" ON "DashboardDefinition"("ownerId") WHERE "isDefault" = true AND "scope" = 'PERSONAL' AND "deletedAt" IS NULL;

ALTER TABLE "DashboardDefinition" ADD CONSTRAINT "DashboardDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardDefinition" ADD CONSTRAINT "DashboardDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardDefinition" ADD CONSTRAINT "DashboardDefinition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "DashboardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "DashboardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionCenterItem" ADD CONSTRAINT "ActionCenterItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionCenterItem" ADD CONSTRAINT "ActionCenterItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionCenterItem" ADD CONSTRAINT "ActionCenterItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionCenterItem" ADD CONSTRAINT "ActionCenterItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionCenterItem" ADD CONSTRAINT "ActionCenterItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
