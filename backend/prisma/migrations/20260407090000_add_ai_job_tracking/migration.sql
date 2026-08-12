-- Add durable AI job tracking to business requests and work items.
ALTER TABLE "BusinessRequest"
ADD COLUMN "aiJob" JSONB;

ALTER TABLE "WorkItem"
ADD COLUMN "aiJob" JSONB;
