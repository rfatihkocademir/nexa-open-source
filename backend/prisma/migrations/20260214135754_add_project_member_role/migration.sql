-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "roleId" TEXT;

-- CreateIndex
CREATE INDEX "ProjectMember_roleId_idx" ON "ProjectMember"("roleId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
