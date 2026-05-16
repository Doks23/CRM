import { and, asc, eq, inArray } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "../client";
import { db } from "@/db";
import {
  aiDrafts,
  emailMessages,
  leads,
  products,
} from "@/db/schema";
import { draft, AiCostCapExceededError } from "@/lib/ai";
import type {
  AiCategory,
  ClassifyOutput,
  LeadLanguage,
  LeadType,
} from "@/lib/ai/types";
import { loadRecentEditExamples } from "@/lib/ai/tone-learning";

const DEFAULT_STAGES: ClassifyOutput["leadType"] extends never ? never : Array<
  "won" | "info_sent" | "negotiation" | "nurture" | "qualified" | "po_received" | "dispatched"
> = ["won", "info_sent", "negotiation", "nurture", "qualified", "po_received", "dispatched"];

/**
 * seasonal-outreach
 *
 * Runs every day at 07:00 IST (cron is UTC, so 01:30 UTC). On the morning of
 * any configured festive date, generates a personalised greeting draft for
 * every active relationship. Owner reviews and sends — same human-in-the-loop
 * as regular drafts.
 *
 * Indian B2B: Diwali / Holi / New Year / Eid are when relationships are
 * made and maintained. Skipping these is a competitive disadvantage.
 */
export const seasonalOutreach = inngest.createFunction(
  {
    id: "seasonal-outreach",
    name: "Generate festive greeting drafts",
    concurrency: { limit: 1 },
    triggers: [{ cron: "30 1 * * *" }, { event: "seasonal/outreach.requested" }],
  },
  async ({ step, logger }) => {
    const profile = await step.run("load-profile", () =>
      db.query.businessProfile.findFirst(),
    );

    if (!profile) {
      return { skipped: true, reason: "no business profile" };
    }

    const festiveDates = (profile.festiveDates ?? []) as Array<{
      date: string;
      label: string;
      stages?: typeof DEFAULT_STAGES;
    }>;

    if (festiveDates.length === 0) {
      return { skipped: true, reason: "no festive dates configured" };
    }

    // Match by MM-DD against today's date in IST.
    const today = new Date();
    const istNow = new Date(today.getTime() + 5.5 * 60 * 60 * 1000);
    const mmdd = `${pad(istNow.getUTCMonth() + 1)}-${pad(istNow.getUTCDate())}`;

    const matches = festiveDates.filter((d) => d.date === mmdd);
    if (matches.length === 0) {
      return { skipped: true, reason: `no festive date today (${mmdd})` };
    }

    const occasion = matches[0]; // if multiple on same day, pick the first
    const stages = occasion.stages ?? DEFAULT_STAGES;

    const targetLeads = await step.run("find-leads", async () => {
      return db.query.leads.findMany({
        where: inArray(leads.stage, stages),
      });
    });

    if (targetLeads.length === 0) {
      return { skipped: true, reason: "no leads in target stages" };
    }

    const activeProducts = await step.run("load-products", () =>
      db.query.products.findMany({ where: eq(products.active, true) }),
    );

    let drafted = 0;
    let skipped = 0;

    for (const lead of targetLeads) {
      const stepKey = `lead-${lead.id}`;
      const outcome = await step.run(stepKey, async () => {
        // Find latest outbound message to anchor the new draft (so it
        // appears in the thread UI).
        const latestOutbound = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.leadId, lead.id),
            eq(emailMessages.direction, "outbound"),
          ),
          orderBy: [asc(emailMessages.receivedAt)],
        });

        if (!latestOutbound) {
          return { status: "skipped" as const, reason: "no thread to anchor" };
        }

        // Bail if we already drafted a greeting today for this lead.
        const existing = await db.query.aiDrafts.findFirst({
          where: and(
            eq(aiDrafts.leadId, lead.id),
            eq(aiDrafts.inReplyToMessageId, latestOutbound.id),
            eq(aiDrafts.status, "pending"),
          ),
        });
        if (existing) {
          return { status: "skipped" as const, reason: "pending draft exists" };
        }

        // Load minimal thread for context (last 3 messages).
        const thread = await db.query.emailMessages.findMany({
          where: eq(emailMessages.leadId, lead.id),
          orderBy: [asc(emailMessages.receivedAt)],
        });

        const recentLang =
          (thread.findLast?.((m) => !!m.detectedLanguage)?.detectedLanguage ??
            "en") as LeadLanguage;

        // Synthesise a classification for the drafter. There's no inbound
        // to classify here — we're initiating outreach.
        const synthClassification: ClassifyOutput = {
          category: "relevant" as AiCategory,
          leadType: (lead.leadType ?? "inquiry") as LeadType,
          intent: `Seasonal greeting for ${occasion.label}`,
          confidence: 1,
          language: recentLang,
          extracted:
            (lead.aiExtracted as ClassifyOutput["extracted"]) ?? {},
          reason: "system: festive outreach",
        };

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
                companyName: profile.companyName ?? "White Pops",
                pitchOneLiner: profile.pitchOneLiner ?? "",
                fssaiNumber: profile.fssaiNumber ?? undefined,
                gstin: profile.gstin ?? undefined,
                certifications: profile.certifications ?? undefined,
                defaultCurrency: profile.defaultCurrency ?? "INR",
                defaultTone: profile.defaultTone ?? "warm-professional",
                brandVoice: profile.brandVoice ?? undefined,
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
                preferLanguage: recentLang,
              }),
              instructions:
                `This is an unsolicited greeting message for ${occasion.label}. ` +
                `Keep it short and warm. Wish them well, briefly mention we hope to keep working together, ` +
                `do NOT pitch products, do NOT include prices. Sign off as Team ${profile.companyName ?? "White Pops"}.`,
            },
            {
              provider: profile.drafterProvider ?? "gemini",
              model: profile.drafterModel ?? "gemini-2.5-flash",
            },
            { leadId: lead.id },
          );

          await db.insert(aiDrafts).values({
            leadId: lead.id,
            inReplyToMessageId: latestOutbound.id,
            draftBody: result.body,
            language: result.language,
            status: "pending",
          });
          return { status: "drafted" as const };
        } catch (err) {
          if (err instanceof AiCostCapExceededError) {
            // Stop the whole cron — we can't draft more without spending.
            throw new NonRetriableError(err.message, { cause: err });
          }
          throw err;
        }
      });

      if (outcome.status === "drafted") drafted++;
      else skipped++;
    }

    logger.info("seasonal outreach complete", {
      occasion: occasion.label,
      checked: targetLeads.length,
      drafted,
      skipped,
    });

    return { occasion: occasion.label, drafted, skipped };
  },
);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
