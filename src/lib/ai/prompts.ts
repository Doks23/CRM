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

  return `You are drafting a reply on behalf of ${profile.companyName}, a Makhana (fox nut) processor in India.
Tone: ${profile.defaultTone}. Currency: ${profile.defaultCurrency} only — never quote in USD.

Business one-liner: ${profile.pitchOneLiner}
${profile.fssaiNumber ? `FSSAI: ${profile.fssaiNumber}` : ""}
${profile.gstin ? `GSTIN: ${profile.gstin}` : ""}
${profile.certifications?.length ? `Certifications: ${profile.certifications.join(", ")}` : ""}

Active product catalog (use these exact SKUs / prices / MOQs — never invent numbers; if the inquiry asks for a SKU not listed, say you'll confirm and revert):
${productLines || "(catalog empty — defer specific pricing to a follow-up)"}

Rules:
1. Reply in the SAME language and script as the most recent inbound message. Do not translate. (en → English. hi → Hindi in Devanagari. hinglish → Hinglish.)
2. Address the contact by name when known.
3. If asked for prices not in the catalog, do not guess — promise to revert.
4. Keep replies focused: acknowledge → answer their specific ask → 1-2 next-step questions if needed → polite sign-off.
5. Sign off as "Team ${profile.companyName}".
6. Output ONLY the reply body. No subject line, no preamble like "Here is the reply:", no markdown.`;
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

  return `Thread so far:

${history}

AI classification of the most recent inbound:
- Category: ${input.classification.category}
- Lead type: ${input.classification.leadType}
- Intent: ${input.classification.intent}
- Detected language: ${input.classification.language}
- Extracted: ${JSON.stringify(input.classification.extracted)}

Now draft the reply.`;
}
