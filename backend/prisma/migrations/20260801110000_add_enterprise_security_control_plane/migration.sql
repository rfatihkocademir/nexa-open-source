CREATE TYPE "ProjectDataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "DataResidencyRegion" AS ENUM ('TR', 'EU', 'GLOBAL');

ALTER TABLE "Project"
ADD COLUMN "dataClassification" "ProjectDataClassification" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN "requireExplicitAdminMembership" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OrganizationSecurityPolicy" (
    "organizationId" TEXT NOT NULL,
    "enforceSso" BOOLEAN NOT NULL DEFAULT false,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "allowedIpRanges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 60,
    "sessionMaxMinutes" INTEGER NOT NULL DEFAULT 1440,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "dataResidency" "DataResidencyRegion" NOT NULL DEFAULT 'TR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationSecurityPolicy_pkey" PRIMARY KEY ("organizationId")
);

ALTER TABLE "OrganizationSecurityPolicy"
ADD CONSTRAINT "OrganizationSecurityPolicy_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
