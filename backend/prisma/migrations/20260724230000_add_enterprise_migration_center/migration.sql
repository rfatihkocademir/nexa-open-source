CREATE TABLE "MigrationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANALYZED',
    "mode" TEXT NOT NULL DEFAULT 'UPSERT',
    "mapping" JSONB NOT NULL,
    "sourceData" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "errors" JSONB,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MigrationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MigrationRecord" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "targetId" TEXT,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MigrationRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MigrationJob_projectId_createdAt_idx" ON "MigrationJob"("projectId", "createdAt");
CREATE INDEX "MigrationJob_status_idx" ON "MigrationJob"("status");
CREATE INDEX "MigrationRecord_jobId_status_idx" ON "MigrationRecord"("jobId", "status");
CREATE INDEX "MigrationRecord_targetId_idx" ON "MigrationRecord"("targetId");
CREATE UNIQUE INDEX "MigrationRecord_projectId_source_entityType_externalId_key" ON "MigrationRecord"("projectId", "source", "entityType", "externalId");

ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MigrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
