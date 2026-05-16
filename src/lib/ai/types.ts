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

export interface DraftInput {
  threadHistory: DraftMessage[];
  classification: ClassifyOutput;
  businessProfile: DraftBusinessProfile;
  products: DraftProduct[];
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
