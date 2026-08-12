CREATE TYPE "SecuritySeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SiemDeliveryStatus" AS ENUM ('PENDING', 'RETRYING', 'DELIVERED', 'DEAD_LETTER');
CREATE TYPE "SecurityIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "SiemDestination" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "categories" TEXT[] NOT NULL DEFAULT ARRAY['SECURITY']::TEXT[],
    "minimumSeverity" "SecuritySeverity" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiemDestination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiemDelivery" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "status" "SiemDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "SecuritySeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiemDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "status" "SecurityIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "assignedToId" TEXT,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiemDestination_organizationId_name_key" ON "SiemDestination"("organizationId", "name");
CREATE INDEX "SiemDestination_organizationId_isActive_idx" ON "SiemDestination"("organizationId", "isActive");
CREATE UNIQUE INDEX "SiemDelivery_destinationId_auditLogId_key" ON "SiemDelivery"("destinationId", "auditLogId");
CREATE INDEX "SiemDelivery_status_nextAttemptAt_idx" ON "SiemDelivery"("status", "nextAttemptAt");
CREATE INDEX "SiemDelivery_destinationId_createdAt_idx" ON "SiemDelivery"("destinationId", "createdAt");
CREATE UNIQUE INDEX "SecurityIncident_auditLogId_key" ON "SecurityIncident"("auditLogId");
CREATE INDEX "SecurityIncident_organizationId_status_severity_idx" ON "SecurityIncident"("organizationId", "status", "severity");
CREATE INDEX "SecurityIncident_createdAt_idx" ON "SecurityIncident"("createdAt");

ALTER TABLE "SiemDestination" ADD CONSTRAINT "SiemDestination_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "SiemDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 6);
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_resolution_check" CHECK (
    ("status" <> 'RESOLVED' OR ("resolvedAt" IS NOT NULL AND "resolvedById" IS NOT NULL AND char_length("resolution") >= 10))
);
