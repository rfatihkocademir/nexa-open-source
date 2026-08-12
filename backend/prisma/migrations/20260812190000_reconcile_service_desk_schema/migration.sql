-- Add service-desk and root-cause models that were present in the Prisma
-- schema but missing from the committed migration history.

CREATE TYPE "BugRootCause" AS ENUM (
    'CODE_DEFECT',
    'CONFIGURATION_ERROR',
    'ENVIRONMENT_ISSUE',
    'DATA_ISSUE',
    'REQUIREMENT_GAP',
    'THIRD_PARTY_FAILURE',
    'OTHER'
);

CREATE TYPE "TicketStatus" AS ENUM (
    'OPEN',
    'PENDING',
    'IN_PROGRESS',
    'WAITING_FOR_CUSTOMER',
    'RESOLVED',
    'CLOSED'
);

CREATE TYPE "TicketCategory" AS ENUM (
    'TECHNICAL_SUPPORT',
    'BUG_REPORT',
    'FEATURE_REQUEST',
    'BILLING',
    'ACCESS_REQUEST',
    'OTHER'
);

CREATE TYPE "SlaStatus" AS ENUM (
    'ON_TRACK',
    'NEEDS_ATTENTION',
    'PAUSED',
    'BREACHED',
    'COMPLETED'
);

ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_organizationId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_projectId_fkey";

ALTER TABLE "Project"
    ADD COLUMN "nextTicketNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "WorkItem"
    ADD COLUMN "rootCause" "BugRootCause";

CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "firstResponseTargetMinutes" INTEGER NOT NULL DEFAULT 60,
    "resolutionTargetMinutes" INTEGER NOT NULL DEFAULT 480,
    "isBusinessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceTicket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TicketCategory" NOT NULL DEFAULT 'TECHNICAL_SUPPORT',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT,
    "assigneeId" TEXT,
    "linkedWorkItemId" TEXT,
    "satisfactionRating" INTEGER,
    "satisfactionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SlaTracker" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "policyId" TEXT,
    "status" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "firstResponseDue" TIMESTAMP(3),
    "firstResponseCompletedAt" TIMESTAMP(3),
    "isFirstResponseBreached" BOOLEAN NOT NULL DEFAULT false,
    "resolutionDue" TIMESTAMP(3),
    "resolutionCompletedAt" TIMESTAMP(3),
    "isResolutionBreached" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "totalPausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaTracker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceTicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTicketComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlaPolicy_organizationId_idx" ON "SlaPolicy"("organizationId");
CREATE INDEX "SlaPolicy_projectId_idx" ON "SlaPolicy"("projectId");

CREATE UNIQUE INDEX "ServiceTicket_key_key" ON "ServiceTicket"("key");
CREATE INDEX "ServiceTicket_projectId_status_idx" ON "ServiceTicket"("projectId", "status");
CREATE INDEX "ServiceTicket_organizationId_status_idx" ON "ServiceTicket"("organizationId", "status");
CREATE INDEX "ServiceTicket_assigneeId_idx" ON "ServiceTicket"("assigneeId");
CREATE INDEX "ServiceTicket_requesterEmail_idx" ON "ServiceTicket"("requesterEmail");
CREATE INDEX "ServiceTicket_key_idx" ON "ServiceTicket"("key");

CREATE UNIQUE INDEX "SlaTracker_ticketId_key" ON "SlaTracker"("ticketId");
CREATE INDEX "SlaTracker_ticketId_idx" ON "SlaTracker"("ticketId");
CREATE INDEX "SlaTracker_status_idx" ON "SlaTracker"("status");

CREATE INDEX "ServiceTicketComment_ticketId_idx" ON "ServiceTicketComment"("ticketId");
CREATE INDEX "ServiceTicketComment_authorId_idx" ON "ServiceTicketComment"("authorId");

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SlaPolicy"
    ADD CONSTRAINT "SlaPolicy_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlaPolicy"
    ADD CONSTRAINT "SlaPolicy_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTicket"
    ADD CONSTRAINT "ServiceTicket_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTicket"
    ADD CONSTRAINT "ServiceTicket_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTicket"
    ADD CONSTRAINT "ServiceTicket_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceTicket"
    ADD CONSTRAINT "ServiceTicket_linkedWorkItemId_fkey"
    FOREIGN KEY ("linkedWorkItemId") REFERENCES "WorkItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SlaTracker"
    ADD CONSTRAINT "SlaTracker_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlaTracker"
    ADD CONSTRAINT "SlaTracker_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceTicketComment"
    ADD CONSTRAINT "ServiceTicketComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTicketComment"
    ADD CONSTRAINT "ServiceTicketComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL truncates the original 64-character name differently from
-- Prisma's deterministic naming strategy. Keep future diffs stable.
ALTER INDEX "ActionCenterItem_organizationId_actionType_status_lastSeenAt_id"
    RENAME TO "ActionCenterItem_organizationId_actionType_status_lastSeenA_idx";
