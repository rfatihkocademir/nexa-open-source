/*
  Warnings:

  - A unique constraint covering the columns `[testRunId,testCaseId]` on the table `TestRunItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'SET_COOKIE';
ALTER TYPE "ActionType" ADD VALUE 'SET_LOCAL_STORAGE';
ALTER TYPE "ActionType" ADD VALUE 'API_REQUEST';

-- CreateIndex
CREATE UNIQUE INDEX "TestRunItem_testRunId_testCaseId_key" ON "TestRunItem"("testRunId", "testCaseId");
