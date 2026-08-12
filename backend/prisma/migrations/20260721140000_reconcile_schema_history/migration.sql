-- Reconciles schema changes that previously existed only through db push.
-- Existing matching databases must baseline this migration with prisma migrate resolve.

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('DRAFT', 'BACKLOG', 'TODO', 'OPEN', 'IN_ANALYSIS', 'IN_PROGRESS', 'FIXED', 'READY_FOR_TEST', 'QA', 'RETEST', 'DONE', 'CLOSED', 'REOPENED', 'WAITING_FOR_INFO');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'READY', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('BUSINESS', 'FUNCTIONAL', 'TECHNICAL', 'SECURITY', 'PERFORMANCE', 'UI');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImpactStatus" AS ENUM ('CLEAN', 'IMPACTED', 'STALE', 'NEEDS_REVIEW', 'REAPPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('DEV', 'QA', 'PREPROD', 'PROD');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AutomationScenarioStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkItemType" ADD VALUE 'DEFECT';
ALTER TYPE "WorkItemType" ADD VALUE 'INCIDENT';

-- DropForeignKey
ALTER TABLE "KnowledgeVector" DROP CONSTRAINT "KnowledgeVector_projectId_fkey";

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "BoardColumn" ADD COLUMN     "allowedTransitions" TEXT[],
ADD COLUMN     "color" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mappedStatus" "WorkItemStatus",
ADD COLUMN     "wipLimit" INTEGER;

-- AlterTable
ALTER TABLE "BusinessRequest" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "nextWorkItemNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ReleaseCandidate" ADD COLUMN     "deletedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "ReleaseFollowUp" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "impactReason" TEXT,
ADD COLUMN     "impactStatus" "ImpactStatus" NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "requirementId" TEXT;

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "TestRun" DROP COLUMN "environment",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "environmentId" TEXT;

-- AlterTable
ALTER TABLE "TestStep" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WikiPage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "impactReason" TEXT,
ADD COLUMN     "impactStatus" "ImpactStatus" NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "status" "ArtifactStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "WikiSpace" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkItem" DROP COLUMN "foundInEnv",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "documentationPageId" TEXT,
ADD COLUMN     "foundInEnvId" TEXT,
ADD COLUMN     "impactReason" TEXT,
ADD COLUMN     "impactStatus" "ImpactStatus" NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "requirementId" TEXT,
ADD COLUMN     "sequenceNumber" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "WorkItemStatus" NOT NULL DEFAULT 'TODO';

-- AlterTable
ALTER TABLE "Worklog" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "KnowledgeVector";

-- DropEnum
DROP TYPE "Environment";

-- DropEnum
DROP TYPE "ReleaseReadinessStatus";

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "EnvironmentType" NOT NULL DEFAULT 'QA',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "deploymentPolicy" TEXT,
    "rollbackPolicy" TEXT,
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseWorkItem" (
    "releaseCandidateId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseWorkItem_pkey" PRIMARY KEY ("releaseCandidateId","workItemId")
);

-- CreateTable
CREATE TABLE "AutomationScenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "requirementId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutomationScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationScenarioStep" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "testStepId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationScenarioStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "templateBody" TEXT NOT NULL,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "config" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactRevision" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "changeReason" TEXT,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ArtifactRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "RequirementType" NOT NULL DEFAULT 'FUNCTIONAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "sourceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectKnowledge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- CreateIndex
CREATE INDEX "Environment_deletedAt_idx" ON "Environment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_projectId_name_key" ON "Environment"("projectId", "name");

-- CreateIndex
CREATE INDEX "ReleaseWorkItem_workItemId_idx" ON "ReleaseWorkItem"("workItemId");

-- CreateIndex
CREATE INDEX "AutomationScenario_projectId_idx" ON "AutomationScenario"("projectId");

-- CreateIndex
CREATE INDEX "AutomationScenario_testCaseId_idx" ON "AutomationScenario"("testCaseId");

-- CreateIndex
CREATE INDEX "AutomationScenario_requirementId_idx" ON "AutomationScenario"("requirementId");

-- CreateIndex
CREATE INDEX "AutomationScenario_deletedAt_idx" ON "AutomationScenario"("deletedAt");

-- CreateIndex
CREATE INDEX "AutomationScenarioStep_scenarioId_idx" ON "AutomationScenarioStep"("scenarioId");

-- CreateIndex
CREATE INDEX "AutomationScenarioStep_testStepId_idx" ON "AutomationScenarioStep"("testStepId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_slug_key" ON "PromptTemplate"("slug");

-- CreateIndex
CREATE INDEX "PromptTemplate_deletedAt_idx" ON "PromptTemplate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_templateId_version_key" ON "PromptVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "ArtifactRevision_entityType_entityId_idx" ON "ArtifactRevision"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ArtifactRevision_authorId_idx" ON "ArtifactRevision"("authorId");

-- CreateIndex
CREATE INDEX "ArtifactRevision_deletedAt_idx" ON "ArtifactRevision"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactRevision_entityType_entityId_version_key" ON "ArtifactRevision"("entityType", "entityId", "version");

-- CreateIndex
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- CreateIndex
CREATE INDEX "Requirement_sourceRequestId_idx" ON "Requirement"("sourceRequestId");

-- CreateIndex
CREATE INDEX "Requirement_authorId_idx" ON "Requirement"("authorId");

-- CreateIndex
CREATE INDEX "Requirement_deletedAt_idx" ON "Requirement"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectKnowledge_projectId_idx" ON "ProjectKnowledge"("projectId");

-- CreateIndex
CREATE INDEX "ProjectKnowledge_entityType_entityId_idx" ON "ProjectKnowledge"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_deletedAt_idx" ON "Attachment"("deletedAt");

-- CreateIndex
CREATE INDEX "BusinessRequest_deletedAt_idx" ON "BusinessRequest"("deletedAt");

-- CreateIndex
CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");

-- CreateIndex
CREATE INDEX "Integration_deletedAt_idx" ON "Integration"("deletedAt");

-- CreateIndex
CREATE INDEX "Milestone_deletedAt_idx" ON "Milestone"("deletedAt");

-- CreateIndex
CREATE INDEX "Notification_deletedAt_idx" ON "Notification"("deletedAt");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_status_createdAt_idx" ON "ReleaseCandidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_deletedAt_idx" ON "ReleaseCandidate"("deletedAt");

-- CreateIndex
CREATE INDEX "ReleaseFollowUp_deletedAt_idx" ON "ReleaseFollowUp"("deletedAt");

-- CreateIndex
CREATE INDEX "Tag_deletedAt_idx" ON "Tag"("deletedAt");

-- CreateIndex
CREATE INDEX "TestResult_deletedAt_idx" ON "TestResult"("deletedAt");

-- CreateIndex
CREATE INDEX "TestRun_deletedAt_idx" ON "TestRun"("deletedAt");

-- CreateIndex
CREATE INDEX "TestStep_deletedAt_idx" ON "TestStep"("deletedAt");

-- CreateIndex
CREATE INDEX "WikiPage_deletedAt_idx" ON "WikiPage"("deletedAt");

-- CreateIndex
CREATE INDEX "WikiSpace_deletedAt_idx" ON "WikiSpace"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_key_key" ON "WorkItem"("key");

-- CreateIndex
CREATE INDEX "WorkItem_deletedAt_idx" ON "WorkItem"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkItem_key_idx" ON "WorkItem"("key");

-- CreateIndex
CREATE INDEX "Worklog_deletedAt_idx" ON "Worklog"("deletedAt");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_documentationPageId_fkey" FOREIGN KEY ("documentationPageId") REFERENCES "WikiPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_foundInEnvId_fkey" FOREIGN KEY ("foundInEnvId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWorkItem" ADD CONSTRAINT "ReleaseWorkItem_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWorkItem" ADD CONSTRAINT "ReleaseWorkItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenario" ADD CONSTRAINT "AutomationScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenario" ADD CONSTRAINT "AutomationScenario_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenario" ADD CONSTRAINT "AutomationScenario_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenarioStep" ADD CONSTRAINT "AutomationScenarioStep_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "AutomationScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenarioStep" ADD CONSTRAINT "AutomationScenarioStep_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "TestStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactRevision" ADD CONSTRAINT "ArtifactRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "BusinessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKnowledge" ADD CONSTRAINT "ProjectKnowledge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
