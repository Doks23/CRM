CREATE TYPE "public"."ai_call_status" AS ENUM('ok', 'error', 'cap_blocked');--> statement-breakpoint
CREATE TYPE "public"."ai_call_task" AS ENUM('classify', 'draft');--> statement-breakpoint
CREATE TYPE "public"."ai_category" AS ENUM('relevant', 'cold', 'spam', 'internal', 'newsletter');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending', 'approved', 'edited', 'sent', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."email_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'hi', 'hinglish');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('linkedin', 'gmail_direct', 'inquiry_form', 'referral', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'needs_review', 'qualified', 'info_sent', 'negotiation', 'po_received', 'dispatched', 'won', 'lost', 'nurture');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('bulk', 'retail', 'inquiry', 'partnership', 'export', 'sample_request', 'spam');--> statement-breakpoint
CREATE TYPE "public"."llm_provider" AS ENUM('gemini', 'openai', 'ollama');--> statement-breakpoint
CREATE TYPE "public"."sample_status" AS ENUM('pending_dispatch', 'in_transit', 'delivered', 'follow_up_sent', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'sales', 'production');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "ai_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" "ai_call_task" NOT NULL,
	"provider" "llm_provider" NOT NULL,
	"model" text NOT NULL,
	"lead_id" uuid,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_inr" numeric(10, 4),
	"latency_ms" integer,
	"status" "ai_call_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"in_reply_to_message_id" uuid,
	"draft_body" text NOT NULL,
	"edited_body" text,
	"language" "language" DEFAULT 'en' NOT NULL,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"gmail_draft_id" text,
	"sent_message_id" text,
	"client_send_key" text,
	"last_synced_at" timestamp,
	"sent_at" timestamp,
	"sent_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "draft_client_send_key_unique" UNIQUE("client_send_key")
);
--> statement-breakpoint
CREATE TABLE "business_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton_lock" text DEFAULT 'singleton' NOT NULL,
	"company_name" text,
	"gstin" text,
	"fssai_number" text,
	"certifications" text[],
	"default_tone" text DEFAULT 'warm-professional',
	"default_currency" text DEFAULT 'INR',
	"pitch_one_liner" text,
	"brand_voice" text,
	"allowed_emails" jsonb DEFAULT '[]'::jsonb,
	"follow_up_info_sent_days" integer DEFAULT 4,
	"follow_up_negotiation_days" integer DEFAULT 3,
	"reorder_nudge_days" integer DEFAULT 90,
	"daily_ai_cost_cap_inr" numeric(10, 2) DEFAULT '100.00',
	"inbox_keywords" text[] DEFAULT '{"makhana"}'::text[],
	"gmail_sync_enabled" boolean DEFAULT true NOT NULL,
	"poll_interval_minutes" integer DEFAULT 2 NOT NULL,
	"festive_dates" jsonb DEFAULT '[]'::jsonb,
	"classifier_provider" "llm_provider" DEFAULT 'gemini' NOT NULL,
	"classifier_model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"drafter_provider" "llm_provider" DEFAULT 'openai' NOT NULL,
	"drafter_model" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profile_singleton_lock_unique" UNIQUE("singleton_lock")
);
--> statement-breakpoint
CREATE TABLE "draft_edit_pair" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"draft_id" uuid,
	"original_body" text NOT NULL,
	"final_body" text NOT NULL,
	"edit_ratio" numeric(4, 3),
	"language" "language",
	"sent_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"gmail_message_id" text NOT NULL,
	"direction" "email_direction" NOT NULL,
	"from_email" text,
	"to_emails" text[],
	"subject" text,
	"received_at" timestamp NOT NULL,
	"body_text" text,
	"body_html" text,
	"ai_category" "ai_category",
	"ai_confidence" numeric(3, 2),
	"ai_reason" text,
	"detected_language" "language",
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_message_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"encrypted_access_token" text,
	"access_token_expires_at" timestamp,
	"last_history_id" text,
	"last_polled_at" timestamp,
	"last_error_kind" text,
	"last_error_message" text,
	"last_error_at" timestamp,
	"last_success_at" timestamp,
	"connected_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_email" text NOT NULL,
	"contact_name" text,
	"company" text,
	"phone" text,
	"source" "lead_source" DEFAULT 'unknown' NOT NULL,
	"lead_type" "lead_type" DEFAULT 'inquiry' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"score" integer DEFAULT 0,
	"assigned_user_id" text,
	"owner_user_id" text,
	"ai_summary" text,
	"ai_extracted" jsonb,
	"notes_for_ai" text,
	"first_contact_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"last_reorder_nudge_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_primary_email_unique" UNIQUE("primary_email")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"grade" text,
	"pack_size" text,
	"moq" integer,
	"price_retail" numeric(12, 2),
	"price_wholesale" numeric(12, 2),
	"stock_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "sample_dispatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" text,
	"quantity_note" text,
	"courier" text,
	"awb" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"follow_up_due_at" timestamp,
	"follow_up_draft_id" uuid,
	"status" "sample_status" DEFAULT 'pending_dispatch' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"lead_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"role" "user_role" DEFAULT 'sales' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_call" ADD CONSTRAINT "ai_call_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_in_reply_to_message_id_email_message_id_fk" FOREIGN KEY ("in_reply_to_message_id") REFERENCES "public"."email_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_edit_pair" ADD CONSTRAINT "draft_edit_pair_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_edit_pair" ADD CONSTRAINT "draft_edit_pair_draft_id_ai_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."ai_draft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_edit_pair" ADD CONSTRAINT "draft_edit_pair_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_account" ADD CONSTRAINT "gmail_account_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_dispatch" ADD CONSTRAINT "sample_dispatch_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_dispatch" ADD CONSTRAINT "sample_dispatch_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_dispatch" ADD CONSTRAINT "sample_dispatch_follow_up_draft_id_ai_draft_id_fk" FOREIGN KEY ("follow_up_draft_id") REFERENCES "public"."ai_draft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_call_created_idx" ON "ai_call" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_call_task_idx" ON "ai_call" USING btree ("task");--> statement-breakpoint
CREATE INDEX "ai_call_status_idx" ON "ai_call" USING btree ("status");--> statement-breakpoint
CREATE INDEX "draft_lead_idx" ON "ai_draft" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "draft_status_idx" ON "ai_draft" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edit_pair_created_idx" ON "draft_edit_pair" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "edit_pair_lead_idx" ON "draft_edit_pair" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "message_thread_idx" ON "email_message" USING btree ("gmail_thread_id");--> statement-breakpoint
CREATE INDEX "message_received_idx" ON "email_message" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "message_lead_idx" ON "email_message" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_last_activity_idx" ON "lead" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "lead_stage_idx" ON "lead" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "lead_assigned_idx" ON "lead" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "sample_lead_idx" ON "sample_dispatch" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sample_status_idx" ON "sample_dispatch" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sample_followup_due_idx" ON "sample_dispatch" USING btree ("follow_up_due_at");