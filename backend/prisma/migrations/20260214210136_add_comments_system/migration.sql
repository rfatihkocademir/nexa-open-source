/*
  Warnings:

  - The values [IN_PROGRESS,REVIEW] on the enum `StoryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StoryStatus_new" AS ENUM ('TODO', 'DEVELOPMENT', 'WAITING_FOR_INFO', 'READY_FOR_TEST', 'IN_TEST', 'DONE');
ALTER TABLE "Story" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Story" ALTER COLUMN "status" TYPE "StoryStatus_new" USING ("status"::text::"StoryStatus_new");
ALTER TYPE "StoryStatus" RENAME TO "StoryStatus_old";
ALTER TYPE "StoryStatus_new" RENAME TO "StoryStatus";
DROP TYPE "StoryStatus_old";
ALTER TABLE "Story" ALTER COLUMN "status" SET DEFAULT 'TODO';
COMMIT;

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "storyId" TEXT,
    "taskId" TEXT,
    "bugId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_storyId_idx" ON "Comment"("storyId");

-- CreateIndex
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");

-- CreateIndex
CREATE INDEX "Comment_bugId_idx" ON "Comment"("bugId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
