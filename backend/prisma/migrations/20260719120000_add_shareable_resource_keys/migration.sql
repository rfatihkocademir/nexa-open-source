ALTER TABLE "Project"
  ADD COLUMN "nextTestRunNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "nextMilestoneNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "nextReleaseNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TestRun" ADD COLUMN "key" TEXT, ADD COLUMN "sequenceNumber" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "key" TEXT, ADD COLUMN "sequenceNumber" INTEGER;
ALTER TABLE "ReleaseCandidate" ADD COLUMN "key" TEXT, ADD COLUMN "sequenceNumber" INTEGER;

-- Test cases and work items used the same visible namespace historically.
-- Keep their sequence stable while assigning test cases an explicit type prefix.
UPDATE "TestCase" tc
SET "key" = p."key" || '-TC-' || tc."sequenceNumber"
FROM "TestSuite" ts
JOIN "Project" p ON p.id = ts."projectId"
WHERE ts.id = tc."suiteId";

WITH numbered AS (
  SELECT tr.id, p."key" AS project_key,
         row_number() OVER (PARTITION BY p.id ORDER BY tr."createdAt", tr.id) AS sequence_number
  FROM "TestRun" tr
  JOIN "Project" p ON p.id = tr."projectId"
)
UPDATE "TestRun" tr
SET "sequenceNumber" = numbered.sequence_number,
    "key" = numbered.project_key || '-TR-' || numbered.sequence_number
FROM numbered WHERE tr.id = numbered.id;

-- Runs without a project remain addressable and receive a globally unique legacy prefix.
WITH unscoped AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS sequence_number
  FROM "TestRun" WHERE "projectId" IS NULL
)
UPDATE "TestRun" tr
SET "sequenceNumber" = unscoped.sequence_number,
    "key" = 'RUN-TR-' || unscoped.sequence_number
FROM unscoped WHERE tr.id = unscoped.id;

WITH numbered AS (
  SELECT m.id, p."key" AS project_key,
         row_number() OVER (PARTITION BY p.id ORDER BY m."dueDate" NULLS LAST, m.id) AS sequence_number
  FROM "Milestone" m JOIN "Project" p ON p.id = m."projectId"
)
UPDATE "Milestone" m
SET "sequenceNumber" = numbered.sequence_number,
    "key" = numbered.project_key || '-MS-' || numbered.sequence_number
FROM numbered WHERE m.id = numbered.id;

WITH numbered AS (
  SELECT rc.id, p."key" AS project_key,
         row_number() OVER (PARTITION BY p.id ORDER BY rc."createdAt", rc.id) AS sequence_number
  FROM "ReleaseCandidate" rc JOIN "Project" p ON p.id = rc."projectId"
)
UPDATE "ReleaseCandidate" rc
SET "sequenceNumber" = numbered.sequence_number,
    "key" = numbered.project_key || '-RC-' || numbered.sequence_number
FROM numbered WHERE rc.id = numbered.id;

UPDATE "Project" p SET
  "nextTestRunNumber" = COALESCE((SELECT max(tr."sequenceNumber") + 1 FROM "TestRun" tr WHERE tr."projectId" = p.id), 1),
  "nextMilestoneNumber" = COALESCE((SELECT max(m."sequenceNumber") + 1 FROM "Milestone" m WHERE m."projectId" = p.id), 1),
  "nextReleaseNumber" = COALESCE((SELECT max(rc."sequenceNumber") + 1 FROM "ReleaseCandidate" rc WHERE rc."projectId" = p.id), 1);

ALTER TABLE "TestRun" ALTER COLUMN "key" SET NOT NULL, ALTER COLUMN "sequenceNumber" SET NOT NULL;
ALTER TABLE "Milestone" ALTER COLUMN "key" SET NOT NULL, ALTER COLUMN "sequenceNumber" SET NOT NULL;
ALTER TABLE "ReleaseCandidate" ALTER COLUMN "key" SET NOT NULL, ALTER COLUMN "sequenceNumber" SET NOT NULL;

CREATE UNIQUE INDEX "TestRun_key_key" ON "TestRun"("key");
CREATE INDEX "TestRun_key_idx" ON "TestRun"("key");
CREATE UNIQUE INDEX "Milestone_key_key" ON "Milestone"("key");
CREATE INDEX "Milestone_key_idx" ON "Milestone"("key");
CREATE UNIQUE INDEX "ReleaseCandidate_key_key" ON "ReleaseCandidate"("key");
CREATE INDEX "ReleaseCandidate_key_idx" ON "ReleaseCandidate"("key");
