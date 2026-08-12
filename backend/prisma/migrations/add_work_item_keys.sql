ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "nextWorkItemNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER;

WITH numbered_items AS (
  SELECT
    wi.id,
    p."key" AS project_key,
    row_number() OVER (
      PARTITION BY p.id
      ORDER BY wi."createdAt", wi.id
    ) AS sequence_number
  FROM "WorkItem" wi
  JOIN "Project" p ON p.id = wi."projectId"
)
UPDATE "WorkItem" wi
SET
  "sequenceNumber" = numbered_items.sequence_number,
  "key" = numbered_items.project_key || '-' || numbered_items.sequence_number
FROM numbered_items
WHERE wi.id = numbered_items.id;

WITH project_item_counts AS (
  SELECT
    p.id,
    coalesce(max(wi."sequenceNumber"), 0) + 1 AS next_number
  FROM "Project" p
  LEFT JOIN "WorkItem" wi ON wi."projectId" = p.id
  GROUP BY p.id
)
UPDATE "Project" p
SET "nextWorkItemNumber" = project_item_counts.next_number
FROM project_item_counts
WHERE p.id = project_item_counts.id;

ALTER TABLE "WorkItem" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "WorkItem" ALTER COLUMN "sequenceNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkItem_key_key" ON "WorkItem"("key");
CREATE INDEX IF NOT EXISTS "WorkItem_key_idx" ON "WorkItem"("key");
