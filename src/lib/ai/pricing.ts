import type { ProviderName } from "./types";

/**
 * Per-model token pricing in INR per 1 million tokens.
 *
 * Sources (rough, snapshot Nov 2025 list prices, converted at ₹84/USD):
 *   - Gemini: https://ai.google.dev/pricing
 *   - OpenAI: https://openai.com/api/pricing
 *   - Ollama (self-hosted): no per-token cost, electricity only.
 *
 * If you change the active model in Settings, double-check the row exists
 * below — anything not in the table is treated as zero-cost (and a warning is
 * logged). When you update prices, just edit this file.
 *
 * Pricing is intentionally local code rather than a DB table: there's only
 * one place to update, version control gives audit trail, and reads are free.
 */

export interface ModelPricing {
  /** INR per 1,000,000 input tokens */
  inputInrPer1M: number;
  /** INR per 1,000,000 output tokens */
  outputInrPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Google Gemini ───────────────────────────────────────────────────
  "gemini-2.5-flash": { inputInrPer1M: 25, outputInrPer1M: 210 }, // $0.30 / $2.50
  "gemini-2.5-flash-lite": { inputInrPer1M: 8, outputInrPer1M: 34 }, // $0.10 / $0.40
  "gemini-2.5-pro": { inputInrPer1M: 105, outputInrPer1M: 840 }, // $1.25 / $10

  // ── OpenAI ──────────────────────────────────────────────────────────
  "gpt-4o": { inputInrPer1M: 210, outputInrPer1M: 840 }, // $2.50 / $10
  "gpt-4o-mini": { inputInrPer1M: 13, outputInrPer1M: 50 }, // $0.15 / $0.60
  "gpt-4.1": { inputInrPer1M: 168, outputInrPer1M: 672 }, // $2 / $8
  "gpt-4.1-mini": { inputInrPer1M: 34, outputInrPer1M: 134 }, // $0.40 / $1.60

  // ── Ollama (self-hosted, no API cost) ───────────────────────────────
  "llama3.1:8b": { inputInrPer1M: 0, outputInrPer1M: 0 },
  "llama3.1:70b": { inputInrPer1M: 0, outputInrPer1M: 0 },
  "qwen2.5:7b": { inputInrPer1M: 0, outputInrPer1M: 0 },
  "qwen2.5:14b": { inputInrPer1M: 0, outputInrPer1M: 0 },
};

/**
 * Compute INR cost for a single call. Returns 0 if usage is unknown or the
 * model isn't in the pricing table — the call still runs, and a soft warning
 * is logged by the caller so we can notice missing rows.
 */
export function computeCostInr(
  model: string,
  tokens: { input: number; output: number } | undefined,
): { costInr: number; missingPricing: boolean } {
  if (!tokens) return { costInr: 0, missingPricing: false };
  const pricing = MODEL_PRICING[model];
  if (!pricing) return { costInr: 0, missingPricing: true };
  const cost =
    (tokens.input * pricing.inputInrPer1M) / 1_000_000 +
    (tokens.output * pricing.outputInrPer1M) / 1_000_000;
  return { costInr: cost, missingPricing: false };
}

/** Pricing tier used only for sorting/display, not gating. */
export function pricingTier(model: string): "free" | "cheap" | "mid" | "premium" {
  const pricing = MODEL_PRICING[model];
  if (!pricing || pricing.outputInrPer1M === 0) return "free";
  if (pricing.outputInrPer1M < 100) return "cheap";
  if (pricing.outputInrPer1M < 500) return "mid";
  return "premium";
}

/** Useful for tests / UI display. */
export function knownModelsForProvider(provider: ProviderName): string[] {
  const prefixes: Record<ProviderName, string[]> = {
    gemini: ["gemini-"],
    openai: ["gpt-"],
    ollama: ["llama", "qwen", "mistral", "phi", "gemma"],
  };
  const prefixSet = prefixes[provider];
  return Object.keys(MODEL_PRICING).filter((m) =>
    prefixSet.some((p) => m.startsWith(p)),
  );
}
