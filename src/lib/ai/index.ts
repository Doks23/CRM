/**
 * Public entry point for the AI layer.
 *
 *     import { classify, draft, defaultModels } from "@/lib/ai";
 *
 * Feature code never imports an SDK directly — it goes through these two
 * functions and the provider is selected from the business profile.
 */

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
  drafter: { provider: "openai" as ProviderName, model: "gpt-4o" },
} as const;

/** Suggested model IDs per provider — surfaced in Settings as quick-picks. */
export const providerModels: Record<
  ProviderName,
  { classifier: string[]; drafter: string[] }
> = {
  gemini: {
    classifier: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    drafter: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  openai: {
    classifier: ["gpt-4o-mini", "gpt-4.1-mini"],
    drafter: ["gpt-4o", "gpt-4.1"],
  },
  ollama: {
    classifier: ["llama3.1:8b", "qwen2.5:7b"],
    drafter: ["llama3.1:70b", "qwen2.5:14b"],
  },
};

/** High-level helpers used by Inngest workers in Milestones 2–3. */
export async function classify(
  input: ClassifyInput,
  config: { provider: ProviderName; model: string },
): Promise<ClassifyOutput> {
  return getProvider(config.provider).classify(input, config.model);
}

export async function draft(
  input: DraftInput,
  config: { provider: ProviderName; model: string },
): Promise<DraftOutput> {
  return getProvider(config.provider).draft(input, config.model);
}

export type {
  ClassifyInput,
  ClassifyOutput,
  DraftInput,
  DraftOutput,
  ProviderName,
} from "./types";
