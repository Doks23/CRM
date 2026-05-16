/**
 * Tone-learning reader.
 *
 * Pulls the most recent meaningful edit pairs and formats them as
 * few-shot examples for the drafter system prompt. NOT yet wired into the
 * prompt builder — that's the next sprint's job. Keeping it as a standalone
 * module so we can iterate on the selection heuristic without touching the
 * draft pipeline.
 *
 * Selection heuristic (intentionally simple):
 *   - Last N pairs where editRatio is between MIN and MAX
 *   - Bucket-bias toward recent + per-language balance
 *   - Skip pairs where finalBody is < 30 chars (probably accidental sends)
 */

import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { draftEditPairs } from "@/db/schema";
import type { LeadLanguage, ToneExample } from "./types";

const MIN_RATIO = 0.04; // ignore typo-fixes
const MAX_RATIO = 0.85; // ignore full rewrites that are basically different replies
const MIN_LENGTH = 30;

export async function loadRecentEditExamples(
  options: { limit?: number; preferLanguage?: LeadLanguage } = {},
): Promise<ToneExample[]> {
  const limit = options.limit ?? 5;

  const rows = await db
    .select({
      language: draftEditPairs.language,
      originalBody: draftEditPairs.originalBody,
      finalBody: draftEditPairs.finalBody,
      editRatio: draftEditPairs.editRatio,
    })
    .from(draftEditPairs)
    .where(
      sql`${draftEditPairs.editRatio} between ${MIN_RATIO} and ${MAX_RATIO}
          and length(${draftEditPairs.finalBody}) >= ${MIN_LENGTH}`,
    )
    .orderBy(desc(draftEditPairs.createdAt))
    .limit(limit * 3); // overfetch so we can balance languages

  const examples: ToneExample[] = rows.map((r) => ({
    language: (r.language ?? "en") as LeadLanguage,
    originalBody: r.originalBody,
    finalBody: r.finalBody,
    editRatio: parseFloat(r.editRatio ?? "0"),
  }));

  if (options.preferLanguage) {
    const preferred = examples.filter((e) => e.language === options.preferLanguage);
    const other = examples.filter((e) => e.language !== options.preferLanguage);
    // Take up to 70% of the slots from preferred language.
    const preferredSlots = Math.ceil(limit * 0.7);
    return [
      ...preferred.slice(0, preferredSlots),
      ...other.slice(0, limit - Math.min(preferred.length, preferredSlots)),
    ].slice(0, limit);
  }

  return examples.slice(0, limit);
}

/** Quick stats for the Reports panel later. */
export async function getEditPairStats(): Promise<{
  count: number;
  avgEditRatio: number;
  unedited: number;
}> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      avgEditRatio: sql<string>`coalesce(avg(${draftEditPairs.editRatio}), 0)`,
      unedited: sql<number>`count(*) filter (where ${draftEditPairs.editRatio} < 0.04)`.mapWith(
        Number,
      ),
    })
    .from(draftEditPairs);
  return {
    count: row?.count ?? 0,
    avgEditRatio: parseFloat(row?.avgEditRatio ?? "0"),
    unedited: row?.unedited ?? 0,
  };
}

// Re-export so feature code can grab the helper without reaching into schema.
export { draftEditPairs } from "@/db/schema";
