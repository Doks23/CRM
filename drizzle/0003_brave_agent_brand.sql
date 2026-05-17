ALTER TYPE "public"."lead_stage" ADD VALUE 'po' BEFORE 'dispatched';--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE 'ignored' BEFORE 'nurture';--> statement-breakpoint
ALTER TABLE "lead" DROP CONSTRAINT "lead_primary_email_unique";--> statement-breakpoint
ALTER TABLE "business_profile" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "lead_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_deleted_at_idx" ON "lead" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_lead_code_unique" UNIQUE("lead_code");