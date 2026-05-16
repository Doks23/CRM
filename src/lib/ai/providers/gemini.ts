import { GoogleGenAI, Type } from "@google/genai";
import {
  type ClassifyInput,
  type ClassifyOutput,
  type DraftInput,
  type DraftOutput,
  type LlmProvider,
  ProviderNotConfiguredError,
} from "../types";
import {
  CLASSIFY_SYSTEM,
  buildClassifyUserPrompt,
  buildDraftSystem,
  buildDraftUserPrompt,
} from "../prompts";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderNotConfiguredError("gemini", "GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
}

// Re-expressed schema using the Gemini Type enum (the SDK requires it).
const classifyResponseSchema = {
  type: Type.OBJECT,
  required: [
    "category",
    "leadType",
    "intent",
    "confidence",
    "language",
    "extracted",
    "reason",
  ],
  properties: {
    category: {
      type: Type.STRING,
      enum: ["relevant", "cold", "spam", "internal", "newsletter"],
    },
    leadType: {
      type: Type.STRING,
      enum: [
        "bulk",
        "retail",
        "inquiry",
        "partnership",
        "export",
        "sample_request",
        "n/a",
      ],
    },
    intent: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    language: { type: Type.STRING, enum: ["en", "hi", "hinglish"] },
    extracted: {
      type: Type.OBJECT,
      properties: {
        contactName: { type: Type.STRING },
        company: { type: Type.STRING },
        phone: { type: Type.STRING },
        quantity: { type: Type.STRING },
        productInterest: { type: Type.STRING },
        region: { type: Type.STRING },
        budget: { type: Type.STRING },
        urgency: { type: Type.STRING, enum: ["low", "medium", "high"] },
      },
    },
    reason: { type: Type.STRING },
  },
};

export const geminiProvider: LlmProvider = {
  name: "gemini",

  async classify(input: ClassifyInput, modelId: string): Promise<ClassifyOutput> {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: buildClassifyUserPrompt(input),
      config: {
        systemInstruction: CLASSIFY_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: classifyResponseSchema,
        temperature: 0.1,
      },
    });
    const text = response.text;
    if (!text) throw new Error("Gemini returned empty classification");
    const parsed = JSON.parse(text) as ClassifyOutput;
    if (response.usageMetadata) {
      parsed.tokensUsed = {
        input: response.usageMetadata.promptTokenCount ?? 0,
        output: response.usageMetadata.candidatesTokenCount ?? 0,
      };
    }
    return parsed;
  },

  async draft(input: DraftInput, modelId: string): Promise<DraftOutput> {
    const ai = getClient();
    const system = buildDraftSystem(input.businessProfile, input.products);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: buildDraftUserPrompt(input),
      config: {
        systemInstruction: system,
        temperature: 0.5,
      },
    });
    const body = response.text?.trim();
    if (!body) throw new Error("Gemini returned empty draft");
    return {
      body,
      language: input.classification.language,
      tokensUsed: response.usageMetadata
        ? {
            input: response.usageMetadata.promptTokenCount ?? 0,
            output: response.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  },
};
