import OpenAI from "openai";
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
  CLASSIFY_JSON_SCHEMA,
  buildClassifyUserPrompt,
  buildDraftSystem,
  buildDraftUserPrompt,
} from "../prompts";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ProviderNotConfiguredError("openai", "OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

export const openaiProvider: LlmProvider = {
  name: "openai",

  async classify(
    input: ClassifyInput,
    modelId: string,
  ): Promise<ClassifyOutput> {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: modelId,
      temperature: 0.1,
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: buildClassifyUserPrompt(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lead_classification",
          schema: CLASSIFY_JSON_SCHEMA,
          strict: false,
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty classification");
    return JSON.parse(content) as ClassifyOutput;
  },

  async draft(input: DraftInput, modelId: string): Promise<DraftOutput> {
    const client = getClient();
    const system = buildDraftSystem(input.businessProfile, input.products);
    const response = await client.chat.completions.create({
      model: modelId,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: buildDraftUserPrompt(input) },
      ],
    });
    const body = response.choices[0]?.message?.content?.trim();
    if (!body) throw new Error("OpenAI returned empty draft");
    return {
      body,
      language: input.classification.language,
      tokensUsed: response.usage
        ? {
            input: response.usage.prompt_tokens,
            output: response.usage.completion_tokens,
          }
        : undefined,
    };
  },
};
