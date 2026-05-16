-- Add new enum values for the simplified pipeline stages.
-- ALTER TYPE ... ADD VALUE is safe in a transaction and non-blocking in PG 9.3+.

ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'po';
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'ignored';
