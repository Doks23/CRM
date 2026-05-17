-- Add logo_url to business_profile
ALTER TABLE business_profile ADD COLUMN logo_url text;

-- Add avatar_url to users
ALTER TABLE "user" ADD COLUMN avatar_url text;