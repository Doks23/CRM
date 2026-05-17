ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
CREATE INDEX IF NOT EXISTS "lead_deleted_at_idx" ON "lead" ("deleted_at");
