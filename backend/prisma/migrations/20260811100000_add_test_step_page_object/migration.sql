ALTER TABLE "TestStep" ADD COLUMN "pageObject" TEXT;

CREATE INDEX "TestStep_projectId_pageObject_idx" ON "TestStep"("projectId", "pageObject");
