import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "../client";
import { db } from "@/db";
import { emailMessages, leads } from "@/db/schema";
import { classify, AiCostCapExceededError } from "@/lib/ai";
import { enrichFromWeb } from "@/lib/enrich";
import { computeLeadScore } from "@/lib/lead-score";

export const aiClassify = inngest.createFunction(
  {
    id: "ai-classify",
    name: "Classify inbound email with AI",
    concurrency: { limit: 5 },
    triggers: [{ event: "ai/classify.requested" }],
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

    if (message.processedAt) {
      return { skipped: true, reason: "already classified" };
    }

    const profile = await step.run("load-profile", async () => {
      return await db.query.businessProfile.findFirst();
    });

    const result = await step.run("classify", async () => {
      try {
        return await classify(
          {
            subject: message.subject ?? "",
            bodyText: message.bodyText ?? "",
            fromEmail: message.fromEmail ?? "",
          },
          {
            provider: profile?.classifierProvider ?? "gemini",
            model: profile?.classifierModel ?? "gemini-2.5-flash",
          },
          { leadId: message.leadId },
        );
      } catch (err) {
        // Daily cap is a deterministic refusal — retrying won't help, and
        // Inngest would otherwise hammer the cap-blocked path repeatedly.
        if (err instanceof AiCostCapExceededError) {
          throw new NonRetriableError(err.message, { cause: err });
        }
        throw err;
      }
    });

    const enrichment = await step.run("enrich-from-web", async () => {
      const fromEmail = message.fromEmail ?? "";
      const knownCompany = result.extracted.company;
      return enrichFromWeb(fromEmail, knownCompany);
    });

    await step.run("persist", async () => {
      const aiExtracted = enrichment?.enriched
        ? { ...result.extracted, enrichment }
        : result.extracted;

      const companyName = enrichment?.enriched && enrichment.companyName
        ? enrichment.companyName
        : result.extracted.company;

      await db.transaction(async (tx) => {
        await tx
          .update(emailMessages)
          .set({
            aiCategory: result.category,
            aiConfidence: result.confidence.toString(),
            aiReason: result.reason,
            detectedLanguage: result.language,
            processedAt: new Date(),
          })
          .where(eq(emailMessages.id, message.id));

        const lead = await tx.query.leads.findFirst({
          where: eq(leads.id, message.leadId),
        });
        if (lead) {
          const score = computeLeadScore(result);
          await tx
            .update(leads)
            .set({
              contactName: result.extracted.contactName ?? lead.contactName,
              company: companyName ?? lead.company,
              phone: result.extracted.phone ?? lead.phone,
              // Update the type from the classifier so the score uses the
              // latest signal next time we recompute.
              leadType:
                result.leadType !== "n/a" ? result.leadType : lead.leadType,
              score,
              aiSummary: result.reason,
              aiExtracted,
            })
            .where(eq(leads.id, lead.id));
        }
      });
    });

    await step.run("enqueue-draft", async () => {
      if (result.category === "relevant") {
        await inngest.send({
          name: "ai/draft.requested" as const,
          data: { gmailMessageId },
        });
      }
    });

    return {
      gmailMessageId,
      category: result.category,
      confidence: result.confidence,
    };
  },
);
