ALTER TABLE "Project" ADD COLUMN "slug" TEXT;
ALTER TABLE "Project" ADD COLUMN "primaryTeamId" TEXT;
ALTER TABLE "Project" ADD COLUMN "nextWikiPageNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Team" ADD COLUMN "slug" TEXT;
ALTER TABLE "WikiPage" ADD COLUMN "key" TEXT;

UPDATE "Project"
SET "slug" = lower("key")
WHERE "slug" IS NULL;

WITH normalized AS (
  SELECT
    id,
    "organizationId",
    COALESCE(NULLIF(trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'team') AS base_slug,
    row_number() OVER (
      PARTITION BY "organizationId", COALESCE(NULLIF(trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'team')
      ORDER BY "createdAt", id
    ) AS duplicate_number
  FROM "Team"
)
UPDATE "Team" AS team
SET "slug" = CASE
  WHEN normalized.duplicate_number = 1 THEN normalized.base_slug
  ELSE normalized.base_slug || '-' || normalized.duplicate_number::text
END
FROM normalized
WHERE team.id = normalized.id;

UPDATE "Project" AS project
SET "primaryTeamId" = (
  SELECT team.id
  FROM "Team" AS team
  WHERE team."organizationId" = project."organizationId"
  ORDER BY team."createdAt", team.id
  LIMIT 1
)
WHERE project."primaryTeamId" IS NULL;

WITH numbered AS (
  SELECT
    page.id,
    project."key" AS project_key,
    row_number() OVER (PARTITION BY project.id ORDER BY page."createdAt", page.id) AS sequence_number
  FROM "WikiPage" AS page
  JOIN "WikiSpace" AS space ON space.id = page."spaceId"
  JOIN "Project" AS project ON project.id = space."projectId"
)
UPDATE "WikiPage" AS page
SET "key" = numbered.project_key || '-DOC-' || numbered.sequence_number::text
FROM numbered
WHERE page.id = numbered.id;

UPDATE "Project" AS project
SET "nextWikiPageNumber" = COALESCE((
  SELECT count(*) + 1
  FROM "WikiPage" AS page
  JOIN "WikiSpace" AS space ON space.id = page."spaceId"
  WHERE space."projectId" = project.id
), 1);

ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Team" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Project_organizationId_slug_key" ON "Project"("organizationId", "slug");
CREATE INDEX "Project_primaryTeamId_idx" ON "Project"("primaryTeamId");
CREATE UNIQUE INDEX "Team_organizationId_slug_key" ON "Team"("organizationId", "slug");
CREATE UNIQUE INDEX "WikiPage_key_key" ON "WikiPage"("key");

CREATE TABLE "ResourceRouteAlias" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "oldPath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceRouteAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResourceRouteAlias_oldPath_key" ON "ResourceRouteAlias"("oldPath");
CREATE INDEX "ResourceRouteAlias_projectId_resourceType_idx" ON "ResourceRouteAlias"("projectId", "resourceType");
CREATE INDEX "ResourceRouteAlias_resourceId_idx" ON "ResourceRouteAlias"("resourceId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_primaryTeamId_fkey"
FOREIGN KEY ("primaryTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceRouteAlias"
ADD CONSTRAINT "ResourceRouteAlias_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
