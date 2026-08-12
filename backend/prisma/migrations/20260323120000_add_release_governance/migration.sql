-- CreateEnum
CREATE TYPE "ReleaseReadinessStatus" AS ENUM ('DRAFT', 'READY', 'CONDITIONAL', 'NOT_READY');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('SCOPE', 'DELIVERY', 'QUALITY', 'RELEASE', 'RISK');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CONDITIONAL', 'NEEDS_MORE_INFO');

-- CreateTable
CREATE TABLE "ReleaseCandidate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ReleaseReadinessStatus" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sprintId" TEXT,
    "milestoneId" TEXT,
    "sourceRequestId" TEXT,
    "totalWorkItems" INTEGER NOT NULL DEFAULT 0,
    "completedWorkItems" INTEGER NOT NULL DEFAULT 0,
    "openBugs" INTEGER NOT NULL DEFAULT 0,
    "criticalOpenBugs" INTEGER NOT NULL DEFAULT 0,
    "approvedTestCases" INTEGER NOT NULL DEFAULT 0,
    "totalTestCases" INTEGER NOT NULL DEFAULT 0,
    "openRuns" INTEGER NOT NULL DEFAULT 0,
    "failedRunItems" INTEGER NOT NULL DEFAULT 0,
    "blockedRunItems" INTEGER NOT NULL DEFAULT 0,
    "conflictRunItems" INTEGER NOT NULL DEFAULT 0,
    "traceabilityGaps" INTEGER NOT NULL DEFAULT 0,
    "readinessScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseCandidateRun" (
    "releaseCandidateId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,

    CONSTRAINT "ReleaseCandidateRun_pkey" PRIMARY KEY ("releaseCandidateId","testRunId")
);

-- CreateTable
CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL,
    "releaseCandidateId" TEXT NOT NULL,
    "type" "DecisionType" NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseCandidate_projectId_createdAt_idx" ON "ReleaseCandidate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_status_createdAt_idx" ON "ReleaseCandidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReleaseCandidateRun_testRunId_idx" ON "ReleaseCandidateRun"("testRunId");

-- CreateIndex
CREATE INDEX "DecisionRecord_releaseCandidateId_type_createdAt_idx" ON "DecisionRecord"("releaseCandidateId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionRecord_authorId_createdAt_idx" ON "DecisionRecord"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "BusinessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidateRun" ADD CONSTRAINT "ReleaseCandidateRun_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCandidateRun" ADD CONSTRAINT "ReleaseCandidateRun_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
