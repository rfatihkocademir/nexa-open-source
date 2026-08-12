-- CreateEnum
CREATE TYPE "BusinessRequestStatus" AS ENUM ('DRAFT', 'ANALYZED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "BusinessRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "BusinessRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "aiAnalysis" JSONB,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessRequest_projectId_idx" ON "BusinessRequest"("projectId");

-- AddForeignKey
ALTER TABLE "BusinessRequest" ADD CONSTRAINT "BusinessRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRequest" ADD CONSTRAINT "BusinessRequest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
