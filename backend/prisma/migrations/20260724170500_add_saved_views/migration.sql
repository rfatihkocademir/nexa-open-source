CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PERSONAL',
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_userId_projectId_viewType_name_key"
ON "SavedView"("userId", "projectId", "viewType", "name");

CREATE INDEX "SavedView_projectId_viewType_idx"
ON "SavedView"("projectId", "viewType");

CREATE INDEX "SavedView_userId_projectId_idx"
ON "SavedView"("userId", "projectId");

ALTER TABLE "SavedView"
ADD CONSTRAINT "SavedView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedView"
ADD CONSTRAINT "SavedView_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
