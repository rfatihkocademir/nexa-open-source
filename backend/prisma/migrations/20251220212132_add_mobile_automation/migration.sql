-- CreateEnum
CREATE TYPE "MobilePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "MobileDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY');

-- CreateEnum
CREATE TYPE "MobileActionType" AS ENUM ('TAP_ON_TEXT', 'TAP_ON_ID', 'TAP_ON_POINT', 'SWIPE', 'SCROLL', 'INPUT_TEXT', 'PRESS_KEY', 'ASSERT_VISIBLE', 'ASSERT_NOT_VISIBLE', 'WAIT', 'LAUNCH_APP', 'STOP_APP');

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "blockedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalItems" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "untestedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "platform" "MobilePlatform" NOT NULL,
    "osVersion" TEXT,
    "udid" TEXT NOT NULL,
    "status" "MobileDeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "socketId" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileStep" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actionType" "MobileActionType" NOT NULL,
    "selector" TEXT,
    "data" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileScenario" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "appId" TEXT,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileScenarioStep" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileScenarioStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileExecution" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "runItemId" TEXT,
    "status" "ResultStatus" NOT NULL,
    "duration" INTEGER,
    "logs" TEXT,
    "videoUrl" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileDevice_udid_key" ON "MobileDevice"("udid");

-- CreateIndex
CREATE INDEX "MobileStep_projectId_idx" ON "MobileStep"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileScenario_testCaseId_key" ON "MobileScenario"("testCaseId");

-- CreateIndex
CREATE INDEX "MobileScenarioStep_scenarioId_idx" ON "MobileScenarioStep"("scenarioId");

-- CreateIndex
CREATE INDEX "MobileScenarioStep_stepId_idx" ON "MobileScenarioStep"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileScenarioStep_scenarioId_stepId_orderIndex_key" ON "MobileScenarioStep"("scenarioId", "stepId", "orderIndex");

-- CreateIndex
CREATE INDEX "MobileExecution_scenarioId_idx" ON "MobileExecution"("scenarioId");

-- CreateIndex
CREATE INDEX "MobileExecution_deviceId_idx" ON "MobileExecution"("deviceId");

-- CreateIndex
CREATE INDEX "MobileExecution_runItemId_idx" ON "MobileExecution"("runItemId");

-- CreateIndex
CREATE INDEX "AutomationExecution_scenarioId_idx" ON "AutomationExecution"("scenarioId");

-- CreateIndex
CREATE INDEX "AutomationExecution_runItemId_idx" ON "AutomationExecution"("runItemId");

-- CreateIndex
CREATE INDEX "AutomationStep_projectId_idx" ON "AutomationStep"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ScenarioStep_scenarioId_idx" ON "ScenarioStep"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioStep_stepId_idx" ON "ScenarioStep"("stepId");

-- CreateIndex
CREATE INDEX "TestCase_suiteId_idx" ON "TestCase"("suiteId");

-- CreateIndex
CREATE INDEX "TestCase_authorId_idx" ON "TestCase"("authorId");

-- CreateIndex
CREATE INDEX "TestCaseHistory_testCaseId_idx" ON "TestCaseHistory"("testCaseId");

-- CreateIndex
CREATE INDEX "TestCaseHistory_changedById_idx" ON "TestCaseHistory"("changedById");

-- CreateIndex
CREATE INDEX "TestResult_runItemId_idx" ON "TestResult"("runItemId");

-- CreateIndex
CREATE INDEX "TestResult_testerId_idx" ON "TestResult"("testerId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_idx" ON "TestRun"("projectId");

-- CreateIndex
CREATE INDEX "TestRun_milestoneId_idx" ON "TestRun"("milestoneId");

-- CreateIndex
CREATE INDEX "TestRun_creatorId_idx" ON "TestRun"("creatorId");

-- CreateIndex
CREATE INDEX "TestRunItem_testRunId_idx" ON "TestRunItem"("testRunId");

-- CreateIndex
CREATE INDEX "TestRunItem_testCaseId_idx" ON "TestRunItem"("testCaseId");

-- CreateIndex
CREATE INDEX "TestRunItem_assigneeId_idx" ON "TestRunItem"("assigneeId");

-- CreateIndex
CREATE INDEX "TestSuite_projectId_idx" ON "TestSuite"("projectId");

-- CreateIndex
CREATE INDEX "TestSuite_parentId_idx" ON "TestSuite"("parentId");

-- AddForeignKey
ALTER TABLE "MobileStep" ADD CONSTRAINT "MobileStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileScenario" ADD CONSTRAINT "MobileScenario_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileScenarioStep" ADD CONSTRAINT "MobileScenarioStep_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MobileScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileScenarioStep" ADD CONSTRAINT "MobileScenarioStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "MobileStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileExecution" ADD CONSTRAINT "MobileExecution_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MobileScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileExecution" ADD CONSTRAINT "MobileExecution_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileExecution" ADD CONSTRAINT "MobileExecution_runItemId_fkey" FOREIGN KEY ("runItemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
