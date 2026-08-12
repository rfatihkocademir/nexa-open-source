-- CreateTable
CREATE TABLE "ReleaseFollowUp" (
    "id" TEXT NOT NULL,
    "releaseCandidateId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "sourceActionType" TEXT NOT NULL,
    "sourceActionFocus" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseFollowUp_releaseCandidateId_workItemId_key" ON "ReleaseFollowUp"("releaseCandidateId", "workItemId");

-- CreateIndex
CREATE INDEX "ReleaseFollowUp_releaseCandidateId_idx" ON "ReleaseFollowUp"("releaseCandidateId");

-- CreateIndex
CREATE INDEX "ReleaseFollowUp_workItemId_idx" ON "ReleaseFollowUp"("workItemId");

-- CreateIndex
CREATE INDEX "ReleaseFollowUp_createdById_idx" ON "ReleaseFollowUp"("createdById");

-- AddForeignKey
ALTER TABLE "ReleaseFollowUp" ADD CONSTRAINT "ReleaseFollowUp_releaseCandidateId_fkey" FOREIGN KEY ("releaseCandidateId") REFERENCES "ReleaseCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseFollowUp" ADD CONSTRAINT "ReleaseFollowUp_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseFollowUp" ADD CONSTRAINT "ReleaseFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
