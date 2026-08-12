CREATE TYPE "PortfolioStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'ARCHIVED');
CREATE TYPE "InitiativeStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'AT_RISK', 'BLOCKED', 'DONE', 'CANCELLED');
CREATE TYPE "PortfolioDependencyType" AS ENUM ('DEPENDS_ON', 'BLOCKS', 'RELATED');

ALTER TABLE "WorkItem" ADD COLUMN "initiativeId" TEXT;

CREATE TABLE "Portfolio" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "PortfolioStatus" NOT NULL DEFAULT 'ACTIVE', "ownerId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3), "targetDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortfolioProgram" (
  "id" TEXT NOT NULL, "portfolioId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#2563eb', "startDate" TIMESTAMP(3), "targetDate" TIMESTAMP(3),
  "orderIndex" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PortfolioProgram_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortfolioProject" (
  "id" TEXT NOT NULL, "portfolioId" TEXT NOT NULL, "programId" TEXT, "projectId" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 50, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioProject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortfolioInitiative" (
  "id" TEXT NOT NULL, "programId" TEXT NOT NULL, "projectId" TEXT, "parentId" TEXT, "ownerId" TEXT,
  "title" TEXT NOT NULL, "description" TEXT, "status" "InitiativeStatus" NOT NULL DEFAULT 'PLANNED',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM', "startDate" TIMESTAMP(3), "targetDate" TIMESTAMP(3),
  "progressOverride" INTEGER, "estimatedEffortPoints" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PortfolioInitiative_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PortfolioDependency" (
  "id" TEXT NOT NULL, "sourceInitiativeId" TEXT NOT NULL, "targetInitiativeId" TEXT NOT NULL,
  "type" "PortfolioDependencyType" NOT NULL DEFAULT 'DEPENDS_ON', "lagDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PortfolioDependency_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Portfolio_organizationId_status_idx" ON "Portfolio"("organizationId", "status");
CREATE INDEX "Portfolio_ownerId_idx" ON "Portfolio"("ownerId");
CREATE INDEX "PortfolioProgram_portfolioId_orderIndex_idx" ON "PortfolioProgram"("portfolioId", "orderIndex");
CREATE INDEX "PortfolioProject_programId_idx" ON "PortfolioProject"("programId");
CREATE INDEX "PortfolioProject_projectId_idx" ON "PortfolioProject"("projectId");
CREATE UNIQUE INDEX "PortfolioProject_portfolioId_projectId_key" ON "PortfolioProject"("portfolioId", "projectId");
CREATE INDEX "PortfolioInitiative_programId_status_idx" ON "PortfolioInitiative"("programId", "status");
CREATE INDEX "PortfolioInitiative_projectId_idx" ON "PortfolioInitiative"("projectId");
CREATE INDEX "PortfolioInitiative_parentId_idx" ON "PortfolioInitiative"("parentId");
CREATE INDEX "PortfolioInitiative_ownerId_idx" ON "PortfolioInitiative"("ownerId");
CREATE INDEX "PortfolioDependency_targetInitiativeId_idx" ON "PortfolioDependency"("targetInitiativeId");
CREATE UNIQUE INDEX "PortfolioDependency_sourceInitiativeId_targetInitiativeId_t_key" ON "PortfolioDependency"("sourceInitiativeId", "targetInitiativeId", "type");
CREATE INDEX "WorkItem_initiativeId_idx" ON "WorkItem"("initiativeId");

ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioProgram" ADD CONSTRAINT "PortfolioProgram_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PortfolioProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PortfolioProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PortfolioInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioDependency" ADD CONSTRAINT "PortfolioDependency_sourceInitiativeId_fkey" FOREIGN KEY ("sourceInitiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioDependency" ADD CONSTRAINT "PortfolioDependency_targetInitiativeId_fkey" FOREIGN KEY ("targetInitiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
