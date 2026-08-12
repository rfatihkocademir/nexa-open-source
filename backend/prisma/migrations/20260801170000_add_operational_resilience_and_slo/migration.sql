CREATE TYPE "RecoveryEvidenceType" AS ENUM ('BACKUP', 'RESTORE_DRILL');
CREATE TYPE "RecoveryEvidenceStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "OperationalPolicy" (
    "organizationId" TEXT NOT NULL,
    "availabilityTargetPct" DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    "latencyP95TargetMs" INTEGER NOT NULL DEFAULT 800,
    "errorRateTargetPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rpoTargetMinutes" INTEGER NOT NULL DEFAULT 1440,
    "rtoTargetMinutes" INTEGER NOT NULL DEFAULT 240,
    "backupMaxAgeHours" INTEGER NOT NULL DEFAULT 26,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "maintenanceEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationalPolicy_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "RecoveryEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "RecoveryEvidenceType" NOT NULL,
    "status" "RecoveryEvidenceStatus" NOT NULL,
    "reference" TEXT NOT NULL,
    "checksum" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "measuredRpoMinutes" INTEGER,
    "measuredRtoMinutes" INTEGER,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SloHourlyBucket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "goodRequests" INTEGER NOT NULL DEFAULT 0,
    "serverErrors" INTEGER NOT NULL DEFAULT 0,
    "latencyBuckets" INTEGER[] NOT NULL DEFAULT ARRAY[0,0,0,0,0,0,0]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SloHourlyBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecoveryEvidence_organizationId_type_completedAt_idx" ON "RecoveryEvidence"("organizationId", "type", "completedAt");
CREATE INDEX "RecoveryEvidence_status_idx" ON "RecoveryEvidence"("status");
CREATE UNIQUE INDEX "SloHourlyBucket_organizationId_bucketStart_key" ON "SloHourlyBucket"("organizationId", "bucketStart");
CREATE INDEX "SloHourlyBucket_bucketStart_idx" ON "SloHourlyBucket"("bucketStart");

ALTER TABLE "OperationalPolicy" ADD CONSTRAINT "OperationalPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryEvidence" ADD CONSTRAINT "RecoveryEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryEvidence" ADD CONSTRAINT "RecoveryEvidence_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SloHourlyBucket" ADD CONSTRAINT "SloHourlyBucket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalPolicy" ADD CONSTRAINT "OperationalPolicy_targets_check" CHECK (
  "availabilityTargetPct" >= 90 AND "availabilityTargetPct" < 100
  AND "latencyP95TargetMs" >= 50 AND "latencyP95TargetMs" <= 30000
  AND "errorRateTargetPct" > 0 AND "errorRateTargetPct" <= 10
  AND "rpoTargetMinutes" >= 1 AND "rtoTargetMinutes" >= 1
  AND "backupMaxAgeHours" >= 1 AND "backupMaxAgeHours" <= 720
);
ALTER TABLE "RecoveryEvidence" ADD CONSTRAINT "RecoveryEvidence_time_check" CHECK ("completedAt" >= "startedAt");
