/**
 * Provider-agnostic AI layer.
 * Feature code should import { getClassifier, getDrafter } from "@/lib/ai"
 * and never reach for an SDK directly.
 */

export type LeadLanguage = "en" | "hi" | "hinglish";

export type AiCategory =
  | "relevant"
  | "cold"
  | "spam"
  | "internal"
  | "newsletter";

export type LeadType =
  | "bulk"
  | "retail"
  | "inquiry"
  | "partnership"
  | "export"
  | "sample_request"
  | "n/a";

export type Urgency = "low" | "medium" | "high";

export type ProviderName = "gemini" | "openai" | "ollama";

export interface ClassifyInput {
  subject: string;
  bodyText: string;
  fromEmail: string;
  fromName?: string;
}

export interface ClassifyOutput {
  category: AiCategory;
  leadType: LeadType;
  intent: string;
  confidence: number;
  language: LeadLanguage;
  extracted: {
    contactName?: string;
    company?: string;
    phone?: string;
    quantity?: string;
    productInterest?: string;
    region?: string;
    budget?: string;
    urgency?: Urgency;
  };
  reason: string;
  /** Surfaced by every provider so the telemetry layer can compute cost. */
  tokensUsed?: { input: number; output: number };
}

export interface DraftMessage {
  direction: "inbound" | "outbound";
  from?: string;
  bodyText: string;
  receivedAt: Date;
}

export interface DraftBusinessProfile {
  companyName: string;
  pitchOneLiner: string;
  fssaiNumber?: string;
  gstin?: string;
  certifications?: string[];
  defaultCurrency: string;
  defaultTone: string;
  /** Owner-curated freeform "voice file" — sample phrases, do's and don'ts. */
  brandVoice?: string;
}

export interface DraftLeadMemory {
  /** Freeform notes the owner / sales team wrote about this specific lead. */
  notesForAi?: string;
  /** Useful denormalised context — saves the AI from re-reading the lead row. */
  contactName?: string;
  company?: string;
  stage?: string;
  leadType?: string;
}

export interface DraftProduct {
  sku: string;
  name: string;
  grade?: string;
  packSize?: string;
  moq?: number;
  priceRetail?: string;
  priceWholesale?: string;
  stockNote?: string;
}

export interface ToneExample {
  language: LeadLanguage;
  originalBody: string;
  finalBody: string;
  /** 0..1 — proportion of characters changed between original and final. */
  editRatio: number;
}

export interface DraftInput {
  threadHistory: DraftMessage[];
  classification: ClassifyOutput;
  businessProfile: DraftBusinessProfile;
  products: DraftProduct[];
  /** Per-lead memory: the single biggest personalisation lever. */
  leadMemory?: DraftLeadMemory;
  /** Per-call instructions from the sales rep ("be firmer on payment terms"). */
  instructions?: string;
  /** Recent AI-vs-sent edit pairs. Few-shot examples for tone-learning. */
  toneExamples?: ToneExample[];
}

export interface DraftOutput {
  body: string;
  language: LeadLanguage;
  tokensUsed?: { input: number; output: number };
}

export interface LlmProvider {
  readonly name: ProviderName;
  classify(input: ClassifyInput, modelId: string): Promise<ClassifyOutput>;
  draft(input: DraftInput, modelId: string): Promise<DraftOutput>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: ProviderName, missingEnv: string) {
    super(
      `LLM provider "${provider}" is not configured. Missing env var: ${missingEnv}.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}
