import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "../client";
import { db } from "@/db";
import { aiDrafts, emailMessages, leads, products } from "@/db/schema";
import { draft, AiCostCapExceededError } from "@/lib/ai";
import type {
  AiCategory,
  ClassifyOutput,
  LeadLanguage,
  LeadType,
} from "@/lib/ai/types";
import { loadRecentEditExamples } from "@/lib/ai/tone-learning";

/**
 * repeat-order-radar
 *
 * Runs every morning. For each lead in the `dispatched` stage whose latest inbound
 * message is older than `reorderNudgeDays`, drafts a "due for reorder?"
 * check-in message. Owner reviews and sends — same as any other draft.
 *
 * Two guardrails keep this from spamming:
 *   1. `lastReorderNudgeAt` — we won't nudge the same lead within the
 *      cadence window. Set by this function.
 *   2. Skip if there's already a pending draft anchored to the latest
 *      outbound (the owner hasn't sent the existing nudge yet).
 */
export const repeatOrderRadar = inngest.createFunction(
  {
    id: "repeat-order-radar",
    name: "Nudge won leads that have gone silent",
    concurrency: { limit: 1 },
    triggers: [{ cron: "10 2 * * *" }, { event: "reorder/scan.requested" }],
  },
  async ({ step, logger }) => {
    const profile = await step.run("load-profile", () =>
      db.query.businessProfile.findFirst(),
    );

    const nudgeDays = profile?.reorderNudgeDays ?? 0;
    if (!nudgeDays || nudgeDays <= 0) {
      return { skipped: true, reason: "reorder radar disabled" };
    }

    const cutoff = new Date(Date.now() - nudgeDays * 86_400_000);

    const candidates = await step.run("find-silent-dispatched-leads", async () => {
      // Dispatched leads where lastActivityAt is older than cutoff AND either we've
      // never nudged or the last nudge was also older than the cadence.
      return db
        .select()
        .from(leads)
        .where(
          and(
            sql`${leads.stage} = 'dispatched'`,
            sql`${leads.lastActivityAt} < ${cutoff}`,
            or(
              isNull(leads.lastReorderNudgeAt),
              sql`${leads.lastReorderNudgeAt} < ${cutoff}`,
            ),
          ),
        );
    });

    if (candidates.length === 0) {
      return { checked: 0, drafted: 0, reason: "no silent dispatched leads" };
    }

    const activeProducts = await step.run("load-products", () =>
      db.query.products.findMany({ where: eq(products.active, true) }),
    );

    let drafted = 0;
    let skipped = 0;

    for (const lead of candidates) {
      const outcome = await step.run(`lead-${lead.id}`, async () => {
        const latestOutbound = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.leadId, lead.id),
            eq(emailMessages.direction, "outbound"),
          ),
          orderBy: [desc(emailMessages.receivedAt)],
        });
        if (!latestOutbound) {
          return { status: "skipped" as const, reason: "no outbound message" };
        }

        const existingPending = await db.query.aiDrafts.findFirst({
          where: and(
            eq(aiDrafts.leadId, lead.id),
            eq(aiDrafts.inReplyToMessageId, latestOutbound.id),
            eq(aiDrafts.status, "pending"),
          ),
        });
        if (existingPending) {
          return { status: "skipped" as const, reason: "pending draft exists" };
        }

        const thread = await db.query.emailMessages.findMany({
          where: eq(emailMessages.leadId, lead.id),
          orderBy: [asc(emailMessages.receivedAt)],
        });

        const lang =
          (thread.findLast?.((m) => !!m.detectedLanguage)?.detectedLanguage ??
            "en") as LeadLanguage;

        const synthClassification: ClassifyOutput = {
          category: "relevant" as AiCategory,
          leadType: (lead.leadType ?? "inquiry") as LeadType,
          intent: "Repeat order check-in for a quiet past customer",
          confidence: 1,
          language: lang,
          extracted:
            (lead.aiExtracted as ClassifyOutput["extracted"]) ?? {},
          reason: "system: repeat-order radar",
        };

        const daysSilent = Math.floor(
          (Date.now() - new Date(lead.lastActivityAt).getTime()) / 86_400_000,
        );

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
                `This lead is a past customer (deal stage: dispatched) and has gone silent for ${daysSilent} days. ` +
                `Write a short, warm check-in that asks if they are due for another order. ` +
                `Do NOT push aggressively. Reference the existing relationship. ` +
                `If you know what they bought before (from notes or thread), reference it. ` +
                `Keep it under 5 sentences.`,
            },
            {
              provider: profile?.drafterProvider ?? "gemini",
              model: profile?.drafterModel ?? "gemini-2.5-flash",
            },
            { leadId: lead.id },
          );

          await db.transaction(async (tx) => {
            await tx.insert(aiDrafts).values({
              leadId: lead.id,
              inReplyToMessageId: latestOutbound.id,
              draftBody: result.body,
              language: result.language,
              status: "pending",
            });
            await tx
              .update(leads)
              .set({ lastReorderNudgeAt: new Date() })
              .where(eq(leads.id, lead.id));
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

    logger.info("repeat-order radar complete", {
      checked: candidates.length,
      drafted,
      skipped,
    });

    return { checked: candidates.length, drafted, skipped };
  },
);
