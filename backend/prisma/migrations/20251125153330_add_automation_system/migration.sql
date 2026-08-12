/*
  Warnings:

  - You are about to drop the column `executedAt` on the `TestRunItem` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `TestRunItem` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('NAVIGATE', 'CLICK', 'FILL', 'ASSERT_TEXT', 'ASSERT_VISIBLE', 'WAIT', 'SELECT');

-- AlterEnum
ALTER TYPE "ResultStatus" ADD VALUE 'CONFLICT';

-- AlterTable
ALTER TABLE "TestRunItem" DROP COLUMN "executedAt",
DROP COLUMN "status",
ADD COLUMN     "automationExecutedAt" TIMESTAMP(3),
ADD COLUMN     "automationStatus" "ResultStatus",
ADD COLUMN     "finalStatus" "ResultStatus" NOT NULL DEFAULT 'UNTESTED',
ADD COLUMN     "manualExecutedAt" TIMESTAMP(3),
ADD COLUMN     "manualStatus" "ResultStatus" NOT NULL DEFAULT 'UNTESTED';

-- CreateTable
CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locator" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "data" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationScenario" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioStep" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "runItemId" TEXT,
    "status" "ResultStatus" NOT NULL,
    "duration" INTEGER,
    "logs" TEXT,
    "screenshotUrl" TEXT,
    "traceUrl" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationScenario_testCaseId_key" ON "AutomationScenario"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioStep_scenarioId_stepId_orderIndex_key" ON "ScenarioStep"("scenarioId", "stepId", "orderIndex");

-- AddForeignKey
ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenario" ADD CONSTRAINT "AutomationScenario_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioStep" ADD CONSTRAINT "ScenarioStep_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "AutomationScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioStep" ADD CONSTRAINT "ScenarioStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AutomationStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "AutomationScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_runItemId_fkey" FOREIGN KEY ("runItemId") REFERENCES "TestRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
