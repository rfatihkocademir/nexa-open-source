CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "releaseReason" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalHold_organizationId_status_idx" ON "LegalHold"("organizationId", "status");
CREATE INDEX "LegalHold_projectId_status_idx" ON "LegalHold"("projectId", "status");
CREATE INDEX "LegalHold_createdAt_idx" ON "LegalHold"("createdAt");

ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_reason_length_check" CHECK (char_length("reason") >= 10);
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_release_consistency_check" CHECK (
    ("status" = 'ACTIVE' AND "releasedAt" IS NULL AND "releasedById" IS NULL AND "releaseReason" IS NULL)
    OR
    ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "releasedById" IS NOT NULL AND char_length("releaseReason") >= 10)
);
