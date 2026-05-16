import {
  type ClassifyInput,
  type ClassifyOutput,
  type DraftInput,
  type DraftOutput,
  type LlmProvider,
} from "../types";
import {
  CLASSIFY_SYSTEM,
  CLASSIFY_JSON_SCHEMA,
  buildClassifyUserPrompt,
  buildDraftSystem,
  buildDraftUserPrompt,
} from "../prompts";

/**
 * Ollama runs a local HTTP server (default http://localhost:11434).
 * Override with OLLAMA_BASE_URL. No API key needed.
 *
 * Usage notes:
 * - The model must be pulled locally first: `ollama pull llama3.1:8b`.
 * - JSON-mode is requested via `format: "json"` and the prompt enforces schema.
 */

function baseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
}

interface OllamaChatResponse {
  message?: { content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

async function chat(
  modelId: string,
  system: string,
  user: string,
  opts: { jsonMode?: boolean; temperature?: number } = {},
): Promise<OllamaChatResponse> {
  const url = `${baseUrl()}/api/chat`;
  const body = {
    model: modelId,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options: {
      temperature: opts.temperature ?? 0.3,
    },
    ...(opts.jsonMode ? { format: "json" } : {}),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Ollama request failed: ${res.status} ${res.statusText} — is the local server running at ${baseUrl()}?`,
    );
  }
  return (await res.json()) as OllamaChatResponse;
}

export const ollamaProvider: LlmProvider = {
  name: "ollama",

  async classify(
    input: ClassifyInput,
    modelId: string,
  ): Promise<ClassifyOutput> {
    const system = `${CLASSIFY_SYSTEM}\n\nReturn JSON matching this schema:\n${JSON.stringify(CLASSIFY_JSON_SCHEMA)}`;
    const response = await chat(
      modelId,
      system,
      buildClassifyUserPrompt(input),
      { jsonMode: true, temperature: 0.1 },
    );
    const content = response.message?.content;
    if (!content) throw new Error("Ollama returned empty classification");
    return JSON.parse(content) as ClassifyOutput;
  },

  async draft(input: DraftInput, modelId: string): Promise<DraftOutput> {
    const system = buildDraftSystem(input.businessProfile, input.products);
    const response = await chat(modelId, system, buildDraftUserPrompt(input), {
      temperature: 0.5,
    });
    const body = response.message?.content?.trim();
    if (!body) throw new Error("Ollama returned empty draft");
    return {
      body,
      language: input.classification.language,
      tokensUsed:
        response.prompt_eval_count !== undefined
          ? {
              input: response.prompt_eval_count,
              output: response.eval_count ?? 0,
            }
          : undefined,
    };
  },
};
