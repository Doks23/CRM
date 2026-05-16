/**
 * One-off idempotent schema sync.
 *
 * Why this exists: the project has been using `drizzle-kit push` in dev,
 * so there's no migration history file the kit can diff against. The kit's
 * interactive "do you want to truncate?" prompt fires for new UNIQUE
 * constraints and can't be answered from a non-TTY context.
 *
 * This script applies only the *additive* schema changes from the recent
 * sprints. Every statement is wrapped in `IF NOT EXISTS` or `DO $$ ... $$`
 * so the script is safe to run multiple times. Long-term we should add
 * proper migrations; this gets us unblocked today.
 *
 * Run with:  npx tsx scripts/sync-schema.ts
 */

import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString });

/** Each step is a SQL statement that must be idempotent on its own. */
const STEPS: Array<{ label: string; sql: string }> = [
  // ── Enums ─────────────────────────────────────────────────────────
  {
    label: "enum ai_call_task",
    sql: `DO $$ BEGIN
      CREATE TYPE ai_call_task AS ENUM ('classify', 'draft');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
  },
  {
    label: "enum ai_call_status",
    sql: `DO $$ BEGIN
      CREATE TYPE ai_call_status AS ENUM ('ok', 'error', 'cap_blocked');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
  },
  {
    label: "enum sample_status",
    sql: `DO $$ BEGIN
      CREATE TYPE sample_status AS ENUM (
        'pending_dispatch', 'in_transit', 'delivered', 'follow_up_sent', 'closed'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
  },

  // ── business_profile columns ──────────────────────────────────────
  {
    label: "business_profile.brand_voice",
    sql: `ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS brand_voice text;`,
  },
  {
    label: "business_profile.festive_dates",
    sql: `ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS festive_dates jsonb DEFAULT '[]'::jsonb;`,
  },
  {
    label: "business_profile.reorder_nudge_days",
    sql: `ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS reorder_nudge_days integer DEFAULT 90;`,
  },
  {
    label: "business_profile.singleton_lock",
    sql: `ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS singleton_lock text NOT NULL DEFAULT 'singleton';`,
  },
  {
    label: "business_profile.singleton_lock unique constraint",
    sql: `DO $$ BEGIN
      ALTER TABLE business_profile
        ADD CONSTRAINT business_profile_singleton_lock_unique UNIQUE (singleton_lock);
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
  },

  // ── leads columns ─────────────────────────────────────────────────
  {
    label: "lead.notes_for_ai",
    sql: `ALTER TABLE lead ADD COLUMN IF NOT EXISTS notes_for_ai text;`,
  },
  {
    label: "lead.last_reorder_nudge_at",
    sql: `ALTER TABLE lead ADD COLUMN IF NOT EXISTS last_reorder_nudge_at timestamp;`,
  },

  // ── ai_draft columns ──────────────────────────────────────────────
  {
    label: "ai_draft.client_send_key",
    sql: `ALTER TABLE ai_draft ADD COLUMN IF NOT EXISTS client_send_key text;`,
  },
  {
    label: "ai_draft.client_send_key unique",
    sql: `DO $$ BEGIN
      ALTER TABLE ai_draft
        ADD CONSTRAINT draft_client_send_key_unique UNIQUE (client_send_key);
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;`,
  },

  // ── gmail_account columns ─────────────────────────────────────────
  {
    label: "gmail_account.last_error_kind",
    sql: `ALTER TABLE gmail_account ADD COLUMN IF NOT EXISTS last_error_kind text;`,
  },
  {
    label: "gmail_account.last_error_message",
    sql: `ALTER TABLE gmail_account ADD COLUMN IF NOT EXISTS last_error_message text;`,
  },
  {
    label: "gmail_account.last_error_at",
    sql: `ALTER TABLE gmail_account ADD COLUMN IF NOT EXISTS last_error_at timestamp;`,
  },
  {
    label: "gmail_account.last_success_at",
    sql: `ALTER TABLE gmail_account ADD COLUMN IF NOT EXISTS last_success_at timestamp;`,
  },

  // ── New tables ────────────────────────────────────────────────────
  {
    label: "table ai_call",
    sql: `CREATE TABLE IF NOT EXISTS ai_call (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      task ai_call_task NOT NULL,
      provider llm_provider NOT NULL,
      model text NOT NULL,
      lead_id uuid REFERENCES lead(id) ON DELETE SET NULL,
      input_tokens integer,
      output_tokens integer,
      cost_inr numeric(10, 4),
      latency_ms integer,
      status ai_call_status NOT NULL,
      error_message text,
      created_at timestamp NOT NULL DEFAULT now()
    );`,
  },
  {
    label: "ai_call indexes",
    sql: `CREATE INDEX IF NOT EXISTS ai_call_created_idx ON ai_call (created_at);
          CREATE INDEX IF NOT EXISTS ai_call_task_idx ON ai_call (task);
          CREATE INDEX IF NOT EXISTS ai_call_status_idx ON ai_call (status);`,
  },
  {
    label: "table draft_edit_pair",
    sql: `CREATE TABLE IF NOT EXISTS draft_edit_pair (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      lead_id uuid REFERENCES lead(id) ON DELETE SET NULL,
      draft_id uuid REFERENCES ai_draft(id) ON DELETE SET NULL,
      original_body text NOT NULL,
      final_body text NOT NULL,
      edit_ratio numeric(4, 3),
      language language,
      sent_by text REFERENCES "user"(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );`,
  },
  {
    label: "draft_edit_pair indexes",
    sql: `CREATE INDEX IF NOT EXISTS edit_pair_created_idx ON draft_edit_pair (created_at);
          CREATE INDEX IF NOT EXISTS edit_pair_lead_idx ON draft_edit_pair (lead_id);`,
  },
  {
    label: "table sample_dispatch",
    sql: `CREATE TABLE IF NOT EXISTS sample_dispatch (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      lead_id uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
      product_id uuid REFERENCES product(id) ON DELETE SET NULL,
      sku text,
      quantity_note text,
      courier text,
      awb text,
      sent_at timestamp,
      delivered_at timestamp,
      follow_up_due_at timestamp,
      follow_up_draft_id uuid REFERENCES ai_draft(id) ON DELETE SET NULL,
      status sample_status NOT NULL DEFAULT 'pending_dispatch',
      note text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );`,
  },
  {
    label: "sample_dispatch indexes",
    sql: `CREATE INDEX IF NOT EXISTS sample_lead_idx ON sample_dispatch (lead_id);
          CREATE INDEX IF NOT EXISTS sample_status_idx ON sample_dispatch (status);
          CREATE INDEX IF NOT EXISTS sample_followup_due_idx ON sample_dispatch (follow_up_due_at);`,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log(`Running ${STEPS.length} idempotent schema steps…\n`);
    for (const step of STEPS) {
      try {
        await client.query(step.sql);
        console.log(`  ✓ ${step.label}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ✗ ${step.label}: ${msg}`);
        throw err;
      }
    }
    console.log("\nSchema sync complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
