import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "../client";
import { db } from "@/db";
import {
  aiDrafts,
  emailMessages,
  leads,
  products,
  sampleDispatches,
} from "@/db/schema";
import { draft, AiCostCapExceededError } from "@/lib/ai";
import type {
  AiCategory,
  ClassifyOutput,
  LeadLanguage,
  LeadType,
} from "@/lib/ai/types";
import { loadRecentEditExamples } from "@/lib/ai/tone-learning";

/**
 * sample-followup
 *
 * Runs every morning. Finds samples in `delivered` status whose
 * `follow_up_due_at` has passed and no follow-up draft exists yet. Drafts
 * a short "did you get a chance to try the sample?" check-in anchored to
 * the lead's latest outbound message so it shows up in the thread.
 *
 * On generate: flips sample.status to `follow_up_sent` and stores the
 * draft id on the sample row.
 */
export const sampleFollowup = inngest.createFunction(
  {
    id: "sample-followup",
    name: "Draft follow-ups for delivered samples",
    concurrency: { limit: 1 },
    triggers: [{ cron: "20 2 * * *" }, { event: "samples/followup.requested" }],
  },
  async ({ step, logger }) => {
    const profile = await step.run("load-profile", () =>
      db.query.businessProfile.findFirst(),
    );

    const dueSamples = await step.run("find-due-samples", async () => {
      return db
        .select()
        .from(sampleDispatches)
        .where(
          and(
            eq(sampleDispatches.status, "delivered"),
            sql`${sampleDispatches.followUpDueAt} is not null`,
            lte(sampleDispatches.followUpDueAt, new Date()),
            isNull(sampleDispatches.followUpDraftId),
          ),
        );
    });

    if (dueSamples.length === 0) {
      return { drafted: 0, reason: "no due samples" };
    }

    const activeProducts = await step.run("load-products", () =>
      db.query.products.findMany({ where: eq(products.active, true) }),
    );

    let drafted = 0;
    let skipped = 0;

    for (const sample of dueSamples) {
      const outcome = await step.run(`sample-${sample.id}`, async () => {
        const lead = await db.query.leads.findFirst({
          where: eq(leads.id, sample.leadId),
        });
        if (!lead) {
          return { status: "skipped" as const, reason: "lead gone" };
        }

        const latestOutbound = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.leadId, lead.id),
            eq(emailMessages.direction, "outbound"),
          ),
          orderBy: [desc(emailMessages.receivedAt)],
        });
        if (!latestOutbound) {
          return { status: "skipped" as const, reason: "no thread to anchor" };
        }

        // Don't double-draft.
        const existing = await db.query.aiDrafts.findFirst({
          where: and(
            eq(aiDrafts.leadId, lead.id),
            eq(aiDrafts.inReplyToMessageId, latestOutbound.id),
            or(
              eq(aiDrafts.status, "pending"),
              eq(aiDrafts.status, "approved"),
              eq(aiDrafts.status, "edited"),
            ),
          ),
        });
        if (existing) {
          return { status: "skipped" as const, reason: "draft already exists" };
        }

        const thread = await db.query.emailMessages.findMany({
          where: eq(emailMessages.leadId, lead.id),
          orderBy: [asc(emailMessages.receivedAt)],
        });

        const lang =
          (thread.slice().reverse().find((m) => !!m.detectedLanguage)
            ?.detectedLanguage ?? "en") as LeadLanguage;

        const synthClassification: ClassifyOutput = {
          category: "relevant" as AiCategory,
          leadType: (lead.leadType ?? "sample_request") as LeadType,
          intent: "Follow up after sample delivery",
          confidence: 1,
          language: lang,
          extracted:
            (lead.aiExtracted as ClassifyOutput["extracted"]) ?? {},
          reason: "system: sample follow-up",
        };

        const daysSinceDelivery = sample.deliveredAt
          ? Math.floor(
              (Date.now() - new Date(sample.deliveredAt).getTime()) /
                86_400_000,
            )
          : null;

        try {
          const result = await draft(
            {
              threadHistory: thread.slice(-3).map((m) => ({
                direction: m.direction as "inbound" | "outbound",
                from: m.fromEmail ?? undefined,
                bodyText: m.bodyText ?? "",
                receivedAt: new Date(m.receivedAt),
              })),
              classification: synthClassification,
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
              toneExamples: await loadRecentEditExamples({
                limit: 3,
                preferLanguage: lang,
              }),
              instructions:
                `We sent this lead a sample${sample.sku ? ` of ${sample.sku}` : ""}. ` +
                `It was delivered${daysSinceDelivery !== null ? ` ${daysSinceDelivery} days ago` : ""}. ` +
                `Write a short, warm check-in: ask if they had a chance to try it, what they thought, ` +
                `and offer to share pricing / arrange a call for the next step. Do NOT pressure. ` +
                `Keep it under 4 sentences.`,
            },
            {
              provider: profile?.drafterProvider ?? "gemini",
              model: profile?.drafterModel ?? "gemini-2.5-flash",
            },
            { leadId: lead.id },
          );

          await db.transaction(async (tx) => {
            const [insertedDraft] = await tx
              .insert(aiDrafts)
              .values({
                leadId: lead.id,
                inReplyToMessageId: latestOutbound.id,
                draftBody: result.body,
                language: result.language,
                status: "pending",
              })
              .returning({ id: aiDrafts.id });

            await tx
              .update(sampleDispatches)
              .set({
                status: "follow_up_sent",
                followUpDraftId: insertedDraft.id,
                updatedAt: new Date(),
              })
              .where(eq(sampleDispatches.id, sample.id));
          });

          return { status: "drafted" as const };
        } catch (err) {
          if (err instanceof AiCostCapExceededError) {
            throw new NonRetriableError(err.message, { cause: err });
          }
          throw err;
        }
      });

      if (outcome.status === "drafted") drafted++;
      else skipped++;
    }

    logger.info("sample follow-up complete", {
      checked: dueSamples.length,
      drafted,
      skipped,
    });

    return { checked: dueSamples.length, drafted, skipped };
  },
);
