CREATE TYPE "CustomFieldType" AS ENUM (
  'TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME',
  'SELECT', 'MULTI_SELECT', 'USER', 'MULTI_USER', 'URL'
);

CREATE TABLE "WorkTypeDefinition" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "baseType" "WorkItemType" NOT NULL,
  "icon" TEXT,
  "color" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "fieldType" "CustomFieldType" NOT NULL,
  "itemTypeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "required" BOOLEAN NOT NULL DEFAULT false,
  "defaultValue" JSONB,
  "options" JSONB,
  "validation" JSONB,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkItem" ADD COLUMN "workTypeId" TEXT;

CREATE UNIQUE INDEX "WorkTypeDefinition_projectId_key_key" ON "WorkTypeDefinition"("projectId", "key");
CREATE INDEX "WorkTypeDefinition_projectId_isActive_orderIndex_idx" ON "WorkTypeDefinition"("projectId", "isActive", "orderIndex");
CREATE UNIQUE INDEX "CustomFieldDefinition_projectId_key_key" ON "CustomFieldDefinition"("projectId", "key");
CREATE INDEX "CustomFieldDefinition_projectId_isActive_orderIndex_idx" ON "CustomFieldDefinition"("projectId", "isActive", "orderIndex");
CREATE INDEX "WorkItem_workTypeId_idx" ON "WorkItem"("workTypeId");

ALTER TABLE "WorkTypeDefinition"
  ADD CONSTRAINT "WorkTypeDefinition_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDefinition"
  ADD CONSTRAINT "CustomFieldDefinition_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkTypeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
