/**
 * Public entry point for the AI layer.
 *
 *     import { classify, draft, defaultModels } from "@/lib/ai";
 *
 * Feature code never imports an SDK directly — it goes through these two
 * functions and the provider is selected from the business profile.
 *
 * Every call goes through:
 *   1. Daily cost-cap check (refuse if exceeded)
 *   2. Provider call (timed)
 *   3. Telemetry insert into ai_calls (best-effort, never blocks the result)
 */

import { and, eq, gte, sql } from "drizzle-orm";

import type {
  ClassifyInput,
  ClassifyOutput,
  DraftInput,
  DraftOutput,
  LlmProvider,
  ProviderName,
} from "./types";
import { geminiProvider } from "./providers/gemini";
import { openaiProvider } from "./providers/openai";
import { ollamaProvider } from "./providers/ollama";
import { computeCostInr } from "./pricing";
import { db } from "@/db";
import { aiCalls, businessProfile } from "@/db/schema";

const providers: Record<ProviderName, LlmProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  ollama: ollamaProvider,
};

export function getProvider(name: ProviderName): LlmProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown LLM provider: ${name}`);
  return p;
}

/** Seeded defaults — also referenced by the Settings UI. */
export const defaultModels = {
  classifier: { provider: "gemini" as ProviderName, model: "gemini-2.5-flash" },
  drafter: { provider: "gemini" as ProviderName, model: "gemini-2.5-flash" },
} as const;

/** Suggested model IDs per provider — surfaced in Settings as quick-picks. */
export const providerModels: Record<
  ProviderName,
  { classifier: string[]; drafter: string[] }
> = {
  gemini: {
    classifier: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    drafter: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  openai: {
    classifier: ["gpt-4o-mini", "gpt-4.1-mini"],
    drafter: ["gpt-4o", "gpt-4.1", "gpt-4o-mini"],
  },
  ollama: {
    classifier: ["llama3.1:8b", "qwen2.5:7b"],
    drafter: ["llama3.1:70b", "qwen2.5:14b"],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Cost-cap + telemetry
// ────────────────────────────────────────────────────────────────────────────

export class AiCostCapExceededError extends Error {
  constructor(
    readonly capInr: number,
    readonly spentInr: number,
    readonly task: "classify" | "draft",
  ) {
    super(
      `Daily AI cost cap of ₹${capInr.toFixed(2)} reached ` +
        `(spent ₹${spentInr.toFixed(2)} today). ` +
        `Raise the cap in Settings → Business profile, or wait for tomorrow.`,
    );
    this.name = "AiCostCapExceededError";
  }
}

export interface AiCallContext {
  /** Lead this call relates to (for grouping + audit). Optional. */
  leadId?: string;
}

interface CapStatus {
  capInr: number;
  spentInr: number;
  remainingInr: number;
  /** When cap is 0 or negative we treat it as "no cap". */
  unlimited: boolean;
}

async function getCapStatus(): Promise<CapStatus> {
  const profile = await db.query.businessProfile.findFirst();
  const cap = parseFloat(profile?.dailyAiCostCapInr ?? "0");
  if (!cap || cap <= 0) {
    return { capInr: 0, spentInr: 0, remainingInr: Infinity, unlimited: true };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiCalls.costInr}), 0)`,
    })
    .from(aiCalls)
    .where(
      and(eq(aiCalls.status, "ok"), gte(aiCalls.createdAt, startOfDay)),
    );

  const spent = parseFloat(row?.total ?? "0");
  return {
    capInr: cap,
    spentInr: spent,
    remainingInr: cap - spent,
    unlimited: false,
  };
}

/** Best-effort telemetry insert. Swallows errors so AI calls aren't blocked. */
async function logCall(payload: {
  task: "classify" | "draft";
  provider: ProviderName;
  model: string;
  leadId?: string;
  inputTokens?: number;
  outputTokens?: number;
  costInr: number;
  latencyMs: number | null;
  status: "ok" | "error" | "cap_blocked";
  errorMessage?: string;
}) {
  try {
    await db.insert(aiCalls).values({
      task: payload.task,
      provider: payload.provider,
      model: payload.model,
      leadId: payload.leadId,
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      costInr: payload.costInr.toFixed(4),
      latencyMs: payload.latencyMs,
      status: payload.status,
      errorMessage: payload.errorMessage,
    });
  } catch (err) {
    // Telemetry is non-critical — never let an insert failure cascade.
    // eslint-disable-next-line no-console
    console.warn("[ai] telemetry insert failed", err);
  }
}

async function runWithTelemetry<T extends { tokensUsed?: { input: number; output: number } }>(
  task: "classify" | "draft",
  config: { provider: ProviderName; model: string },
  ctx: AiCallContext | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  // 1. Cap check up-front. If we're already over, refuse without calling.
  const cap = await getCapStatus();
  if (!cap.unlimited && cap.spentInr >= cap.capInr) {
    await logCall({
      task,
      provider: config.provider,
      model: config.model,
      leadId: ctx?.leadId,
      costInr: 0,
      latencyMs: 0,
      status: "cap_blocked",
      errorMessage: `cap ${cap.capInr} reached (spent ${cap.spentInr})`,
    });
    throw new AiCostCapExceededError(cap.capInr, cap.spentInr, task);
  }

  // 2. Provider call.
  const started = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - started;
    const { costInr, missingPricing } = computeCostInr(
      config.model,
      result.tokensUsed,
    );
    if (missingPricing) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ai] no pricing row for model "${config.model}". Add it to src/lib/ai/pricing.ts.`,
      );
    }
    await logCall({
      task,
      provider: config.provider,
      model: config.model,
      leadId: ctx?.leadId,
      inputTokens: result.tokensUsed?.input,
      outputTokens: result.tokensUsed?.output,
      costInr,
      latencyMs,
      status: "ok",
    });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - started;
    await logCall({
      task,
      provider: config.provider,
      model: config.model,
      leadId: ctx?.leadId,
      costInr: 0,
      latencyMs,
      status: "error",
      errorMessage: err instanceof Error ? err.message.slice(0, 500) : String(err),
    });
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export async function classify(
  input: ClassifyInput,
  config: { provider: ProviderName; model: string },
  ctx?: AiCallContext,
): Promise<ClassifyOutput> {
  return runWithTelemetry("classify", config, ctx, () =>
    getProvider(config.provider).classify(input, config.model),
  );
}

export async function draft(
  input: DraftInput,
  config: { provider: ProviderName; model: string },
  ctx?: AiCallContext,
): Promise<DraftOutput> {
  return runWithTelemetry("draft", config, ctx, () =>
    getProvider(config.provider).draft(input, config.model),
  );
}

/** Public read so the UI / API can show cap status without re-implementing. */
export async function getAiCostCapStatus(): Promise<CapStatus> {
  return getCapStatus();
}

export type {
  ClassifyInput,
  ClassifyOutput,
  DraftInput,
  DraftOutput,
  ProviderName,
} from "./types";
