import { sql } from "drizzle-orm";

import { db } from "@/db";
import { businessProfile, type AllowedEmail, type FestiveDate } from "@/db/schema";

/**
 * Single source of truth for reading the business profile.
 *
 * Every feature in the system assumes exactly one row exists. This helper
 * + the `singleton_lock` unique constraint in schema.ts guarantee that
 * invariant — calling code should never use `findFirst()` against the table
 * directly.
 *
 * Creates the row on first read so the rest of the app never has to deal
 * with `profile == null`.
 */
export async function getBusinessProfile() {
  const existing = await db.query.businessProfile.findFirst();
  if (existing) return existing;

  // ON CONFLICT DO NOTHING handles the race where two concurrent first-reads
  // both try to insert. Whichever loses, the SELECT after the insert is the
  // canonical row.
  await db
    .insert(businessProfile)
    .values({ singletonLock: "singleton" })
    .onConflictDoNothing({ target: businessProfile.singletonLock });

  const row = await db.query.businessProfile.findFirst();
  if (!row) {
    throw new Error("business_profile singleton failed to materialise");
  }
  return row;
}

/**
 * Patch fields on the singleton, creating the row if it doesn't exist.
 * Use this from API handlers instead of raw `db.update(businessProfile)`.
 */
export async function upsertBusinessProfile(patch: {
  companyName?: string | null;
  gstin?: string | null;
  fssaiNumber?: string | null;
  certifications?: string[] | null;
  defaultTone?: string | null;
  defaultCurrency?: string | null;
  pitchOneLiner?: string | null;
  brandVoice?: string | null;
  allowedEmails?: AllowedEmail[];
  festiveDates?: FestiveDate[];
  followUpInfoSentDays?: number | null;
  followUpNegotiationDays?: number | null;
  reorderNudgeDays?: number | null;
  dailyAiCostCapInr?: string | null;
  inboxKeywords?: string[];
  gmailSyncEnabled?: boolean;
  pollIntervalMinutes?: number;
  classifierProvider?: "gemini" | "openai" | "ollama";
  classifierModel?: string;
  drafterProvider?: "gemini" | "openai" | "ollama";
  drafterModel?: string;
}) {
  // Guarantee the row exists.
  await getBusinessProfile();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }

  const [row] = await db
    .update(businessProfile)
    .set(updates)
    .where(sql`${businessProfile.singletonLock} = 'singleton'`)
    .returning();

  return row;
}
