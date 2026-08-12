ALTER TABLE "Sprint" ADD COLUMN "capacityPoints" INTEGER;

ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_capacityPoints_check" CHECK ("capacityPoints" IS NULL OR "capacityPoints" > 0);
