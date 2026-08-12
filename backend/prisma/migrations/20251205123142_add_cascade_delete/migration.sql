-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEV', 'QA', 'PREPROD', 'PROD');

-- DropForeignKey
ALTER TABLE "AutomationExecution" DROP CONSTRAINT "AutomationExecution_runItemId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationScenario" DROP CONSTRAINT "AutomationScenario_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationStep" DROP CONSTRAINT "AutomationStep_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Milestone" DROP CONSTRAINT "Milestone_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ScenarioStep" DROP CONSTRAINT "ScenarioStep_stepId_fkey";

-- DropForeignKey
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_suiteId_fkey";

-- DropForeignKey
ALTER TABLE "TestCaseHistory" DROP CONSTRAINT "TestCaseHistory_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "TestResult" DROP CONSTRAINT "TestResult_runItemId_fkey";

-- DropForeignKey
ALTER TABLE "TestRun" DROP CONSTRAINT "TestRun_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TestRunItem" DROP CONSTRAINT "TestRunItem_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "TestRunItem" DROP CONSTRAINT "TestRunItem_testRunId_fkey";

-- DropForeignKey
ALTER TABLE "TestSuite" DROP CONSTRAINT "TestSuite_parentId_fkey";

-- DropForeignKey
ALTER TABLE "TestSuite" DROP CONSTRAINT "TestSuite_projectId_fkey";

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN     "stepResults" JSONB;

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "environment" "Environment" NOT NULL DEFAULT 'QA',
ADD COLUMN     "startDate" TIMESTAMP(3),
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TestRunItem" ADD COLUMN     "casePreconditions" TEXT,
ADD COLUMN     "casePriority" "Priority",
ADD COLUMN     "caseSteps" JSONB,
ADD COLUMN     "caseTitle" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseHistory" ADD CONSTRAINT "TestCaseHistory_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_runItemId_fkey" FOREIGN KEY ("runItemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationScenario" ADD CONSTRAINT "AutomationScenario_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioStep" ADD CONSTRAINT "ScenarioStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AutomationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_runItemId_fkey" FOREIGN KEY ("runItemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
