ALTER TABLE "DashboardPreference" ADD COLUMN "organizationId" TEXT;

UPDATE "DashboardPreference" AS preference
SET "organizationId" = dashboard."organizationId"
FROM "DashboardDefinition" AS dashboard
WHERE dashboard."id" = preference."dashboardId";

ALTER TABLE "DashboardPreference" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DashboardPreference" DROP CONSTRAINT "DashboardPreference_pkey";
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("userId", "organizationId");

DROP INDEX "DashboardDefinition_personal_default_key";
CREATE UNIQUE INDEX "DashboardDefinition_personal_default_key"
ON "DashboardDefinition"("ownerId", "organizationId")
WHERE "isDefault" = true AND "scope" = 'PERSONAL' AND "deletedAt" IS NULL;

CREATE INDEX "DashboardPreference_organizationId_idx" ON "DashboardPreference"("organizationId");
CREATE INDEX "ActionCenterItem_organizationId_actionType_status_lastSeenAt_idx"
ON "ActionCenterItem"("organizationId", "actionType", "status", "lastSeenAt");

ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
