-- Drop the unique constraint on lead.primary_email so the same email
-- can have multiple leads (e.g. different contact points from the same company).
ALTER TABLE "lead" DROP CONSTRAINT IF EXISTS "lead_primary_email_unique";
