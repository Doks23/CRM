import { eq, asc, and } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "../client";
import { db } from "@/db";
import {
  emailMessages,
  leads,
  products,
  aiDrafts,
} from "@/db/schema";
import { draft, AiCostCapExceededError } from "@/lib/ai";
import type { AiCategory, LeadLanguage, LeadType, Urgency } from "@/lib/ai/types";
import { loadRecentEditExamples } from "@/lib/ai/tone-learning";

export const aiDraftFn = inngest.createFunction(
  {
    id: "ai-draft",
    name: "Draft AI reply for relevant emails",
    concurrency: { limit: 3 },
    triggers: [{ event: "ai/draft.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as Record<string, unknown> | undefined;
    const gmailMessageId = typeof data?.gmailMessageId === "string" ? data.gmailMessageId : "";
    if (!gmailMessageId) throw new Error("Invalid event: missing gmailMessageId");

    const message = await step.run("load-message", async () => {
      const msg = await db.query.emailMessages.findFirst({
        where: eq(emailMessages.gmailMessageId, gmailMessageId),
      });
      if (!msg) throw new Error(`Message ${gmailMessageId} not found`);
      return msg;
    });

    if (message.aiCategory !== "relevant") {
      return { skipped: true, reason: `category is ${message.aiCategory}, not relevant` };
    }

    const existingDraft = await step.run("check-existing", async () => {
      return db.query.aiDrafts.findFirst({
        where: and(
          eq(aiDrafts.leadId, message.leadId),
          eq(aiDrafts.inReplyToMessageId, message.id),
        ),
      });
    });

    if (existingDraft) {
      return { skipped: true, reason: "draft already exists" };
    }

    const threadMessages = await step.run("load-thread", async () => {
      return db.query.emailMessages.findMany({
        where: eq(emailMessages.gmailThreadId, message.gmailThreadId),
        orderBy: asc(emailMessages.receivedAt),
      });
    });

    const profile = await step.run("load-profile", async () => {
      return db.query.businessProfile.findFirst();
    });

    const activeProducts = await step.run("load-products", async () => {
      return db.query.products.findMany({
        where: eq(products.active, true),
      });
    });

    const lead = await step.run("load-lead", async () => {
      return db.query.leads.findFirst({
        where: eq(leads.id, message.leadId),
      });
    });

    if (!lead) throw new Error(`Lead ${message.leadId} not found`);
    if (lead.deletedAt) {
      return { skipped: true, reason: "lead deleted" };
    }

    const classification = {
      category: (message.aiCategory ?? "relevant") as AiCategory,
      leadType: (lead.leadType ?? "inquiry") as LeadType,
      intent: message.aiReason ?? "",
      confidence: parseFloat(message.aiConfidence ?? "0.5"),
      language: (message.detectedLanguage ?? "en") as LeadLanguage,
      extracted: (lead.aiExtracted as Record<string, unknown>) ?? {},
      reason: message.aiReason ?? "",
    };

    if (typeof classification.extracted.urgency === "string") {
      classification.extracted.urgency = classification.extracted.urgency as Urgency;
    }

    const toneExamples = await step.run("load-tone-examples", () =>
      loadRecentEditExamples({
        limit: 4,
        preferLanguage: classification.language,
      }),
    );

    const draftInput = {
      threadHistory: threadMessages.map((m) => ({
        direction: m.direction as "inbound" | "outbound",
        from: m.fromEmail ?? undefined,
        bodyText: m.bodyText ?? "",
        receivedAt: new Date(m.receivedAt),
      })),
      classification,
      businessProfile: {
        companyName: profile?.companyName ?? "White Pops",
        pitchOneLiner: profile?.pitchOneLiner ?? "",
        fssaiNumber: profile?.fssaiNumber ?? undefined,
        gstin: profile?.gstin ?? undefined,
        certifications: profile?.certifications ?? undefined,
        defaultCurrency: profile?.defaultCurrency ?? "INR",
        defaultTone: profile?.defaultTone ?? "warm-professional",
        brandVoice: profile?.brandVoice ?? undefined,
      },
      products: activeProducts.map((p) => ({
        sku: p.sku,
        name: p.name,
        grade: p.grade ?? undefined,
        packSize: p.packSize ?? undefined,
        moq: p.moq ?? undefined,
        priceRetail: p.priceRetail ?? undefined,
        priceWholesale: p.priceWholesale ?? undefined,
        stockNote: p.stockNote ?? undefined,
      })),
      leadMemory: {
        notesForAi: lead.notesForAi ?? undefined,
        contactName: lead.contactName ?? undefined,
        company: lead.company ?? undefined,
        stage: lead.stage ?? undefined,
        leadType: lead.leadType ?? undefined,
      },
      toneExamples,
    };

    const result = await step.run("generate-draft", async () => {
      try {
        return await draft(
          draftInput,
          {
            provider: profile?.drafterProvider ?? "gemini",
            model: profile?.drafterModel ?? "gemini-2.5-flash",
          },
          { leadId: message.leadId },
        );
      } catch (err) {
        if (err instanceof AiCostCapExceededError) {
          throw new NonRetriableError(err.message, { cause: err });
        }
        throw err;
      }
    });

    const draftRecord = await step.run("persist-draft", async () => {
      const [record] = await db
        .insert(aiDrafts)
        .values({
          leadId: message.leadId,
          inReplyToMessageId: message.id,
          draftBody: result.body,
          language: result.language,
          status: "pending",
        })
        .returning();
      return record;
    });

    return {
      gmailMessageId,
      draftId: draftRecord.id,
    };
  },
);
