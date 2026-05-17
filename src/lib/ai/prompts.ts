/**
 * Shared prompt templates for classification + drafting.
 * Provider adapters consume these so prompt tuning happens in one place.
 *
 * Refined during Milestone 2 once we have real inbox samples.
 */

import type {
  ClassifyInput,
  DraftInput,
  DraftBusinessProfile,
  DraftProduct,
} from "./types";

export const CLASSIFY_SYSTEM = `You are a triage classifier for White Pops, a Makhana (fox nut) processing company in India.
You read incoming emails and decide whether they are a real lead and what kind.

Categories:
- "relevant"   = a genuine inquiry / order / partnership lead about Makhana, fox nuts, or related food products
- "cold"       = generic sales pitch TO us, vendor outreach, unrelated B2B spam
- "spam"       = phishing, scams, unrelated marketing
- "internal"   = automated notifications, calendar invites, internal team mail
- "newsletter" = subscribed updates, marketing newsletters

Lead types (only meaningful when category="relevant"; otherwise "n/a"):
- bulk            = wholesale/distributor quantities, typically 100kg+
- retail          = end-consumer or small store order
- inquiry         = general info request, catalog, pricing
- partnership     = co-branding, private label, supplier/buyer onboarding
- export          = international buyer, foreign country
- sample_request  = asking for samples specifically

Language detection: classify the email's primary language as "en" (English), "hi" (Hindi in Devanagari script), or "hinglish" (English + Hindi mixed, or Hindi written in roman letters).

IMPORTANT — LinkedIn notification emails: The sender email domain will be linkedin.com or e.linkedin.com, but the email body contains a message from an actual person. Extract that person's name, company, and any contact details from the body — NOT from the email headers. These are real leads being forwarded through LinkedIn; treat them as "relevant".

Be conservative: when in doubt between "relevant" and "cold", lean "relevant" with a lower confidence (0.5-0.7) so the human can review. Only mark "cold"/"spam" with high confidence if you are sure.

Respond with a single JSON object matching the schema. No prose, no markdown fences.`;

export function buildClassifyUserPrompt(input: ClassifyInput): string {
  return `Email to classify:

From: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}
Subject: ${input.subject}

Body:
${input.bodyText.slice(0, 4000)}`;
}

export const CLASSIFY_JSON_SCHEMA = {
  type: "object",
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
      type: "string",
      enum: ["relevant", "cold", "spam", "internal", "newsletter"],
    },
    leadType: {
      type: "string",
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
    intent: { type: "string", description: "One-line summary of intent" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    language: { type: "string", enum: ["en", "hi", "hinglish"] },
    extracted: {
      type: "object",
      properties: {
        contactName: { type: "string" },
        company: { type: "string" },
        phone: { type: "string" },
        quantity: { type: "string" },
        productInterest: { type: "string" },
        region: { type: "string" },
        budget: { type: "string" },
        urgency: { type: "string", enum: ["low", "medium", "high"] },
      },
    },
    reason: { type: "string" },
  },
} as const;

export function buildDraftSystem(
  profile: DraftBusinessProfile,
  products: DraftProduct[],
): string {
  const productLines = products
    .map((p) => {
      const parts = [`- ${p.sku}: ${p.name}`];
      if (p.grade) parts.push(`grade ${p.grade}`);
      if (p.packSize) parts.push(`${p.packSize}`);
      if (p.moq) parts.push(`MOQ ${p.moq}`);
      if (p.priceWholesale) parts.push(`wholesale ₹${p.priceWholesale}`);
      if (p.priceRetail) parts.push(`retail ₹${p.priceRetail}`);
      if (p.stockNote) parts.push(`(${p.stockNote})`);
      return parts.join(" · ");
    })
    .join("\n");

  const brandVoiceBlock = profile.brandVoice?.trim()
    ? `\nHOW WE WRITE (mirror this voice, vocabulary, and rhythm — this is more important than generic "professional tone"):
---
${profile.brandVoice.trim()}
---\n`
    : "";

  return `You are drafting a reply on behalf of ${profile.companyName}, a Makhana (fox nut) processor in India.
Default tone: ${profile.defaultTone}. Currency: ${profile.defaultCurrency} only — never quote in USD.

Business one-liner: ${profile.pitchOneLiner}
${profile.fssaiNumber ? `FSSAI: ${profile.fssaiNumber}` : ""}
${profile.gstin ? `GSTIN: ${profile.gstin}` : ""}
${profile.certifications?.length ? `Certifications: ${profile.certifications.join(", ")}` : ""}
${brandVoiceBlock}
Active product catalog (use these exact SKUs / prices / MOQs — never invent numbers; if the inquiry asks for a SKU not listed, say you'll confirm and revert):
${productLines || "(catalog empty — defer specific pricing to a follow-up)"}

Rules:
1. Reply in the SAME language and script as the most recent inbound message. Do not translate. (en → English. hi → Hindi in Devanagari. hinglish → Hinglish.)
2. Address the contact by name when known.
3. If asked for prices not in the catalog, do not guess — promise to revert.
4. Keep replies focused: acknowledge → answer their specific ask → 1-2 next-step questions if needed → polite sign-off.
5. Sign off as "Team ${profile.companyName}".
6. Output ONLY the reply body. No subject line, no preamble like "Here is the reply:", no markdown of any kind. Do not use asterisks, backticks, or any other markdown formatting characters — plain text only.`;
}

export function buildDraftUserPrompt(input: DraftInput): string {
  const history = input.threadHistory
    .slice(-10)
    .map((m) => {
      const tag = m.direction === "inbound" ? "FROM LEAD" : "OUR REPLY";
      const who = m.from ? ` (${m.from})` : "";
      return `--- ${tag}${who} @ ${m.receivedAt.toISOString()} ---
${m.bodyText.slice(0, 2000)}`;
    })
    .join("\n\n");

  const enrichment = (input.classification.extracted as Record<string, unknown>).enrichment as
    | { companyName?: string | null; websiteSummary?: string | null; source?: string | null }
    | undefined;

  const enrichmentBlock = enrichment?.websiteSummary
    ? `\nCompany website research (from ${enrichment.source ?? "web"}):\n${enrichment.websiteSummary}\n${enrichment.companyName ? `Detected company name: ${enrichment.companyName}` : ""}`
    : "";

  const memory = input.leadMemory;
  const memoryHeader =
    memory && (memory.contactName || memory.company || memory.stage || memory.leadType)
      ? `\nWhat we know about this lead (CRM record):
${memory.contactName ? `- Contact: ${memory.contactName}\n` : ""}${memory.company ? `- Company: ${memory.company}\n` : ""}${memory.leadType ? `- Lead type: ${memory.leadType}\n` : ""}${memory.stage ? `- Pipeline stage: ${memory.stage}\n` : ""}`
      : "";

  const memoryNotesBlock = memory?.notesForAi?.trim()
    ? `\nINTERNAL NOTES from our sales team about this specific lead (treat as ground truth — these override any contradictory web research):
---
${memory.notesForAi.trim()}
---\n`
    : "";

  const instructionsBlock = input.instructions
    ? `\nAdditional instructions from the sales rep for THIS draft: ${input.instructions}\n\nApply these instructions when drafting the reply.`
    : "";

  const toneBlock = formatToneExamples(input.toneExamples ?? []);

  return `Thread so far:

${history}
${memoryHeader}${memoryNotesBlock}
AI classification of the most recent inbound:
- Category: ${input.classification.category}
- Lead type: ${input.classification.leadType}
- Intent: ${input.classification.intent}
- Detected language: ${input.classification.language}
- Extracted: ${JSON.stringify(input.classification.extracted)}
${enrichmentBlock}${toneBlock}${instructionsBlock}

Now draft the reply. Lean on the internal notes above to personalise — if we already know this person's preferences, region, payment habits, prior conversations: use them. Use the company website research only if the notes don't cover something. If neither, proceed from the thread alone.`;
}

/**
 * Few-shot block of recent (AI-original, team-sent) edit pairs. The drafter
 * sees what its previous outputs looked like vs what got sent — implicit
 * style guidance without fine-tuning. Examples are truncated to keep token
 * cost bounded.
 */
function formatToneExamples(
  examples: import("./types").ToneExample[],
): string {
  if (!examples || examples.length === 0) return "";

  const blocks = examples.map((ex, i) => {
    return `Example ${i + 1} (${ex.language}, team edited ${Math.round(ex.editRatio * 100)}%)
AI originally wrote:
${ex.originalBody.slice(0, 500)}
What the team actually sent:
${ex.finalBody.slice(0, 500)}`;
  });

  return `\nHOW THE TEAM EDITS DRAFTS (mirror these patterns — what they changed signals tone and preference):
---
${blocks.join("\n\n---\n\n")}
---\n`;
}
