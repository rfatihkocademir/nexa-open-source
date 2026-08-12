CREATE TYPE "ProjectQualityTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE "QualityGateResult" AS ENUM ('READY', 'CONDITIONAL', 'BLOCKED');
CREATE TYPE "ApprovalRoundStatus" AS ENUM ('AWAITING_CONSENSUS', 'CONSENSUS_REACHED', 'REJECTED', 'INVALIDATED');
CREATE TYPE "StakeholderDecision" AS ENUM ('APPROVE', 'APPROVE_WITH_RESERVATION', 'REJECT', 'ABSTAIN');
CREATE TYPE "DeployPackageStatus" AS ENUM ('READY', 'DEPLOYED', 'VERIFIED', 'ROLLED_BACK', 'CANCELLED');

ALTER TABLE "Project" ADD COLUMN "qualityTier" "ProjectQualityTier" NOT NULL DEFAULT 'TIER_2';

CREATE TABLE "ReleaseScopeSnapshot" (
  "id" TEXT NOT NULL, "releaseCandidateId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "scopeHash" TEXT NOT NULL, "manifest" JSONB NOT NULL, "qualityResult" "QualityGateResult" NOT NULL,
  "qualityMetrics" JSONB NOT NULL, "policySnapshot" JSONB NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleaseScopeSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReleaseScopeSnapshot_releaseCandidateId_version_key" ON "ReleaseScopeSnapshot"("releaseCandidateId", "version");
CREATE INDEX "ReleaseScopeSnapshot_releaseCandidateId_createdAt_idx" ON "ReleaseScopeSnapshot"("releaseCandidateId", "createdAt");
CREATE INDEX "ReleaseScopeSnapshot_scopeHash_idx" ON "ReleaseScopeSnapshot"("scopeHash");

CREATE TABLE "ReleaseApprovalRound" (
  "id" TEXT NOT NULL, "releaseCandidateId" TEXT NOT NULL, "scopeSnapshotId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL, "status" "ApprovalRoundStatus" NOT NULL DEFAULT 'AWAITING_CONSENSUS',
  "requiredStakeholderIds" TEXT[] NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "ReleaseApprovalRound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReleaseApprovalRound_releaseCandidateId_roundNumber_key" ON "ReleaseApprovalRound"("releaseCandidateId", "roundNumber");
CREATE INDEX "ReleaseApprovalRound_releaseCandidateId_status_idx" ON "ReleaseApprovalRound"("releaseCandidateId", "status");
CREATE INDEX "ReleaseApprovalRound_scopeSnapshotId_idx" ON "ReleaseApprovalRound"("scopeSnapshotId");

CREATE TABLE "ReleaseApprovalDecision" (
  "id" TEXT NOT NULL, "roundId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "decision" "StakeholderDecision" NOT NULL, "rationale" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReleaseApprovalDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReleaseApprovalDecision_roundId_userId_key" ON "ReleaseApprovalDecision"("roundId", "userId");
CREATE INDEX "ReleaseApprovalDecision_roundId_decision_idx" ON "ReleaseApprovalDecision"("roundId", "decision");
CREATE INDEX "ReleaseApprovalDecision_userId_createdAt_idx" ON "ReleaseApprovalDecision"("userId", "createdAt");

CREATE TABLE "DeployPackage" (
  "id" TEXT NOT NULL, "releaseCandidateId" TEXT NOT NULL, "scopeSnapshotId" TEXT NOT NULL,
  "approvalRoundId" TEXT NOT NULL, "packageNumber" INTEGER NOT NULL,
  "status" "DeployPackageStatus" NOT NULL DEFAULT 'READY', "manifest" JSONB NOT NULL,
  "packageHash" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeployPackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeployPackage_releaseCandidateId_packageNumber_key" ON "DeployPackage"("releaseCandidateId", "packageNumber");
CREATE INDEX "DeployPackage_releaseCandidateId_createdAt_idx" ON "DeployPackage"("releaseCandidateId", "createdAt");
CREATE INDEX "DeployPackage_packageHash_idx" ON "DeployPackage"("packageHash");

ALTER TABLE "ReleaseScopeSnapshot" ADD CONSTRAINT "ReleaseScopeSnapshot_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseScopeSnapshot" ADD CONSTRAINT "ReleaseScopeSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseApprovalRound" ADD CONSTRAINT "ReleaseApprovalRound_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseApprovalRound" ADD CONSTRAINT "ReleaseApprovalRound_scopeSnapshotId_fkey" FOREIGN KEY ("scopeSnapshotId") REFERENCES "ReleaseScopeSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseApprovalRound" ADD CONSTRAINT "ReleaseApprovalRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseApprovalDecision" ADD CONSTRAINT "ReleaseApprovalDecision_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReleaseApprovalRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseApprovalDecision" ADD CONSTRAINT "ReleaseApprovalDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeployPackage" ADD CONSTRAINT "DeployPackage_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeployPackage" ADD CONSTRAINT "DeployPackage_scopeSnapshotId_fkey" FOREIGN KEY ("scopeSnapshotId") REFERENCES "ReleaseScopeSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeployPackage" ADD CONSTRAINT "DeployPackage_approvalRoundId_fkey" FOREIGN KEY ("approvalRoundId") REFERENCES "ReleaseApprovalRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeployPackage" ADD CONSTRAINT "DeployPackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
