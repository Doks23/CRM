import type { ClassifyOutput, LeadType, Urgency } from "@/lib/ai/types";

/**
 * Compute a 0..100 lead score from the classifier output.
 *
 * Score = confidence × urgency_weight × type_weight × 100, clamped.
 *
 * Tunable here in one place. Re-runs every time a message is classified
 * (latest signal wins, which is what you want — a cold lead that turns hot
 * via a "ready to PO" reply should jump).
 */

const URGENCY_WEIGHT: Record<Urgency, number> = {
  low: 0.55,
  medium: 0.8,
  high: 1.0,
};

const TYPE_WEIGHT: Record<LeadType, number> = {
  // High-value (likely to close on real spend)
  bulk: 1.0,
  export: 1.0,
  partnership: 0.95,
  // Mid
  sample_request: 0.85,
  inquiry: 0.7,
  // Lower-value
  retail: 0.55,
  "n/a": 0.3,
};

const CATEGORY_GATE: Record<ClassifyOutput["category"], number> = {
  relevant: 1.0,
  cold: 0.25,
  newsletter: 0,
  internal: 0,
  spam: 0,
};

export function computeLeadScore(c: ClassifyOutput): number {
  const cat = CATEGORY_GATE[c.category] ?? 0.5;
  if (cat === 0) return 0;

  const urgency: Urgency = (c.extracted.urgency as Urgency | undefined) ?? "medium";
  const urgencyW = URGENCY_WEIGHT[urgency] ?? 0.7;

  const typeW = TYPE_WEIGHT[c.leadType] ?? 0.5;

  // confidence ∈ [0,1]; cap at a floor so a wishy-washy classify doesn't
  // zero the score for an otherwise clear "relevant" inbound.
  const confidence = Math.max(0.4, Math.min(1, c.confidence ?? 0.5));

  const raw = cat * urgencyW * typeW * confidence * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}
