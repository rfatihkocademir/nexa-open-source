/*
  Warnings:

  - You are about to drop the column `bugId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `storyId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `storyId` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the column `bugId` on the `Worklog` table. All the data in the column will be lost.
  - You are about to drop the column `storyId` on the `Worklog` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `Worklog` table. All the data in the column will be lost.
  - You are about to drop the `AutomationExecution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationScenario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Bug` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Epic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MobileDevice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MobileExecution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MobileScenario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MobileScenarioStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MobileStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScenarioStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Story` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('GENERAL', 'TEST_EVIDENCE', 'STEP_IMAGE', 'AUTOMATION_VIDEO', 'WIKI_IMAGE', 'AVATAR', 'PROJECT_LOGO');

-- CreateEnum
CREATE TYPE "TestPlatform" AS ENUM ('MANUAL', 'WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('EPIC', 'STORY', 'TASK', 'BUG');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('SLACK', 'JIRA', 'GITHUB', 'GITLAB', 'DISCORD', 'CUSTOM_WEBHOOK');

-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('TEST_RUN_COMPLETED', 'TEST_FAILED', 'BUG_CREATED', 'TEST_CASE_APPROVED');

-- DropForeignKey
ALTER TABLE "AutomationExecution" DROP CONSTRAINT "AutomationExecution_runItemId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationExecution" DROP CONSTRAINT "AutomationExecution_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationScenario" DROP CONSTRAINT "AutomationScenario_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationStep" DROP CONSTRAINT "AutomationStep_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_testResultId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_bugId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Epic" DROP CONSTRAINT "Epic_projectId_fkey";

-- DropForeignKey
ALTER TABLE "MobileExecution" DROP CONSTRAINT "MobileExecution_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "MobileExecution" DROP CONSTRAINT "MobileExecution_runItemId_fkey";

-- DropForeignKey
ALTER TABLE "MobileExecution" DROP CONSTRAINT "MobileExecution_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "MobileScenario" DROP CONSTRAINT "MobileScenario_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "MobileScenarioStep" DROP CONSTRAINT "MobileScenarioStep_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "MobileScenarioStep" DROP CONSTRAINT "MobileScenarioStep_stepId_fkey";

-- DropForeignKey
ALTER TABLE "MobileStep" DROP CONSTRAINT "MobileStep_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ScenarioStep" DROP CONSTRAINT "ScenarioStep_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "ScenarioStep" DROP CONSTRAINT "ScenarioStep_stepId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_epicId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_sprintId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_storyId_fkey";

-- DropForeignKey
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Worklog" DROP CONSTRAINT "Worklog_bugId_fkey";

-- DropForeignKey
ALTER TABLE "Worklog" DROP CONSTRAINT "Worklog_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Worklog" DROP CONSTRAINT "Worklog_taskId_fkey";

-- DropIndex
DROP INDEX "Comment_bugId_idx";

-- DropIndex
DROP INDEX "Comment_storyId_idx";

-- DropIndex
DROP INDEX "Comment_taskId_idx";

-- DropIndex
DROP INDEX "TestCase_storyId_idx";

-- DropIndex
DROP INDEX "Worklog_bugId_idx";

-- DropIndex
DROP INDEX "Worklog_storyId_idx";

-- DropIndex
DROP INDEX "Worklog_taskId_idx";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "bugId",
DROP COLUMN "storyId",
DROP COLUMN "taskId",
ADD COLUMN     "workItemId" TEXT;

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "storyId",
ADD COLUMN     "automationScript" TEXT,
ADD COLUMN     "workItemId" TEXT,
ALTER COLUMN "steps" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Worklog" DROP COLUMN "bugId",
DROP COLUMN "storyId",
DROP COLUMN "taskId",
ADD COLUMN     "workItemId" TEXT;

-- DropTable
DROP TABLE "AutomationExecution";

-- DropTable
DROP TABLE "AutomationScenario";

-- DropTable
DROP TABLE "AutomationStep";

-- DropTable
DROP TABLE "Bug";

-- DropTable
DROP TABLE "Epic";

-- DropTable
DROP TABLE "MobileDevice";

-- DropTable
DROP TABLE "MobileExecution";

-- DropTable
DROP TABLE "MobileScenario";

-- DropTable
DROP TABLE "MobileScenarioStep";

-- DropTable
DROP TABLE "MobileStep";

-- DropTable
DROP TABLE "ScenarioStep";

-- DropTable
DROP TABLE "Story";

-- DropTable
DROP TABLE "Task";

-- DropEnum
DROP TYPE "BugStatus";

-- DropEnum
DROP TYPE "MobileActionType";

-- DropEnum
DROP TYPE "MobileDeviceStatus";

-- DropEnum
DROP TYPE "MobilePlatform";

-- DropEnum
DROP TYPE "StoryStatus";

-- CreateTable
CREATE TABLE "ProjectElement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locator" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pageUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "action" TEXT,
    "expectedResult" TEXT,
    "type" "TestPlatform" NOT NULL DEFAULT 'MANUAL',
    "actionType" TEXT,
    "locator" TEXT,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseStep" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "testStepId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemType" "WorkItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "boardColumnId" TEXT,
    "boardOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "sprintId" TEXT,
    "assigneeId" TEXT,
    "reporterId" TEXT,
    "storyPoints" INTEGER,
    "acceptanceCriteria" TEXT,
    "stepsToReproduce" TEXT,
    "severity" "BugSeverity",
    "foundInEnv" "Environment",
    "testResultId" TEXT,
    "sourceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL DEFAULT 'nexa',
    "thumbnailKey" TEXT,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'GENERAL',
    "workItemId" TEXT,
    "commentId" TEXT,
    "testResultId" TEXT,
    "testCaseId" TEXT,
    "wikiPageId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "event" "WebhookEvent" NOT NULL,
    "payloadTemplate" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "requestBody" JSONB,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "isSuccess" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitCommit" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectElement_projectId_idx" ON "ProjectElement"("projectId");

-- CreateIndex
CREATE INDEX "TestStep_projectId_idx" ON "TestStep"("projectId");

-- CreateIndex
CREATE INDEX "TestCaseStep_testCaseId_idx" ON "TestCaseStep"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCaseStep_testStepId_idx" ON "TestCaseStep"("testStepId");

-- CreateIndex
CREATE INDEX "BoardColumn_projectId_idx" ON "BoardColumn"("projectId");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");

-- CreateIndex
CREATE INDEX "WorkItem_sprintId_idx" ON "WorkItem"("sprintId");

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_idx" ON "WorkItem"("assigneeId");

-- CreateIndex
CREATE INDEX "Attachment_workItemId_idx" ON "Attachment"("workItemId");

-- CreateIndex
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");

-- CreateIndex
CREATE INDEX "Attachment_testResultId_idx" ON "Attachment"("testResultId");

-- CreateIndex
CREATE INDEX "Attachment_testCaseId_idx" ON "Attachment"("testCaseId");

-- CreateIndex
CREATE INDEX "Attachment_wikiPageId_idx" ON "Attachment"("wikiPageId");

-- CreateIndex
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- CreateIndex
CREATE INDEX "Integration_projectId_idx" ON "Integration"("projectId");

-- CreateIndex
CREATE INDEX "Webhook_integrationId_idx" ON "Webhook"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_integrationId_event_key" ON "Webhook"("integrationId", "event");

-- CreateIndex
CREATE INDEX "WebhookLog_webhookId_createdAt_idx" ON "WebhookLog"("webhookId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GitCommit_hash_key" ON "GitCommit"("hash");

-- CreateIndex
CREATE INDEX "GitCommit_projectId_idx" ON "GitCommit"("projectId");

-- CreateIndex
CREATE INDEX "GitCommit_workItemId_idx" ON "GitCommit"("workItemId");

-- CreateIndex
CREATE INDEX "PullRequest_workItemId_idx" ON "PullRequest"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_projectId_prNumber_key" ON "PullRequest"("projectId", "prNumber");

-- CreateIndex
CREATE INDEX "Comment_workItemId_idx" ON "Comment"("workItemId");

-- CreateIndex
CREATE INDEX "TestCase_workItemId_idx" ON "TestCase"("workItemId");

-- CreateIndex
CREATE INDEX "Worklog_workItemId_idx" ON "Worklog"("workItemId");

-- AddForeignKey
ALTER TABLE "ProjectElement" ADD CONSTRAINT "ProjectElement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStep" ADD CONSTRAINT "TestStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "TestStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_boardColumnId_fkey" FOREIGN KEY ("boardColumnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "TestResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "BusinessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_wikiPageId_fkey" FOREIGN KEY ("wikiPageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitCommit" ADD CONSTRAINT "GitCommit_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
