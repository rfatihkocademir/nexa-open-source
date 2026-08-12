ALTER TABLE "Project" ADD COLUMN "key" TEXT;
ALTER TABLE "Project" ADD COLUMN "nextTestCaseNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TestCase" ADD COLUMN "key" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "sequenceNumber" INTEGER;

CREATE OR REPLACE FUNCTION generate_project_key_base(project_name TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
  word TEXT;
  words TEXT[];
  initials TEXT := '';
  single_word TEXT;
  consonants TEXT;
BEGIN
  cleaned := upper(regexp_replace(coalesce(project_name, 'PRJ'), '[^A-Za-z0-9]+', ' ', 'g'));
  words := regexp_split_to_array(trim(cleaned), '\s+');

  IF array_length(words, 1) IS NULL THEN
    RETURN 'PRJ';
  END IF;

  IF array_length(words, 1) = 1 THEN
    single_word := regexp_replace(words[1], '[^A-Z0-9]', '', 'g');
    IF length(single_word) <= 5 THEN
      RETURN rpad(left(single_word, 5), 2, 'X');
    END IF;
    consonants := substr(single_word, 1, 1) || regexp_replace(substr(single_word, 2), '[AEIOU]', '', 'g');
    RETURN rpad(left(CASE WHEN length(consonants) >= 2 THEN consonants ELSE single_word END, 5), 2, 'X');
  END IF;

  FOREACH word IN ARRAY words LOOP
    IF word NOT IN ('THE', 'A', 'AN', 'AND', 'OR', 'OF', 'FOR', 'TO', 'IN', 'ON', 'WITH') THEN
      initials := initials || substr(word, 1, 1);
    END IF;
  END LOOP;

  IF length(initials) < 2 THEN
    initials := 'PRJ';
  END IF;

  RETURN left(initials, 5);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  project_record RECORD;
  base_key TEXT;
  candidate_key TEXT;
  suffix INTEGER;
  suffix_text TEXT;
BEGIN
  FOR project_record IN SELECT id, name FROM "Project" ORDER BY "createdAt", id LOOP
    base_key := generate_project_key_base(project_record.name);
    candidate_key := base_key;
    suffix := 2;

    WHILE EXISTS (
      SELECT 1 FROM "Project" WHERE "key" = candidate_key AND id <> project_record.id
    ) LOOP
      suffix_text := suffix::TEXT;
      candidate_key := left(base_key, greatest(2, 5 - length(suffix_text))) || suffix_text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE "Project" SET "key" = candidate_key WHERE id = project_record.id;
  END LOOP;
END $$;

WITH numbered_cases AS (
  SELECT
    tc.id,
    p."key" AS project_key,
    row_number() OVER (
      PARTITION BY p.id
      ORDER BY tc."createdAt", tc.id
    ) AS sequence_number
  FROM "TestCase" tc
  JOIN "TestSuite" ts ON ts.id = tc."suiteId"
  JOIN "Project" p ON p.id = ts."projectId"
)
UPDATE "TestCase" tc
SET
  "sequenceNumber" = numbered_cases.sequence_number,
  "key" = numbered_cases.project_key || '-' || numbered_cases.sequence_number
FROM numbered_cases
WHERE tc.id = numbered_cases.id;

WITH project_case_counts AS (
  SELECT
    p.id,
    coalesce(max(tc."sequenceNumber"), 0) + 1 AS next_number
  FROM "Project" p
  LEFT JOIN "TestSuite" ts ON ts."projectId" = p.id
  LEFT JOIN "TestCase" tc ON tc."suiteId" = ts.id
  GROUP BY p.id
)
UPDATE "Project" p
SET "nextTestCaseNumber" = project_case_counts.next_number
FROM project_case_counts
WHERE p.id = project_case_counts.id;

ALTER TABLE "Project" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "TestCase" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "TestCase" ALTER COLUMN "sequenceNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");
CREATE UNIQUE INDEX "TestCase_key_key" ON "TestCase"("key");
CREATE INDEX "TestCase_key_idx" ON "TestCase"("key");

DROP FUNCTION generate_project_key_base(TEXT);
