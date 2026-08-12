CREATE TYPE "WorkflowSchemeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "WorkflowScheme" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "WorkflowSchemeStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  "draftConfig" JSONB NOT NULL,
  "publishedConfig" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowScheme_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkflowRevision" (
  "id" TEXT NOT NULL,
  "schemeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "config" JSONB NOT NULL,
  "changeNote" TEXT,
  "publishedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowScheme_projectId_key" ON "WorkflowScheme"("projectId");
CREATE UNIQUE INDEX "WorkflowRevision_schemeId_version_key" ON "WorkflowRevision"("schemeId", "version");
CREATE INDEX "WorkflowRevision_schemeId_createdAt_idx" ON "WorkflowRevision"("schemeId", "createdAt");
ALTER TABLE "WorkflowScheme" ADD CONSTRAINT "WorkflowScheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRevision" ADD CONSTRAINT "WorkflowRevision_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "WorkflowScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRevision" ADD CONSTRAINT "WorkflowRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
