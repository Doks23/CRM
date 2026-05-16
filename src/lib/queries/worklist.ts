import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  aiDrafts,
  emailMessages,
  leads,
  sampleDispatches,
} from "@/db/schema";
import { getAiCostCapStatus } from "@/lib/ai";
import { getBusinessProfile } from "@/lib/business-profile";

/**
 * Today's worklist — five counters the owner / sales rep want to see in
 * one glance. Powered by SQL aggregates (no per-row fetches) so this stays
 * cheap to compute on every dashboard render.
 *
 * Exposed both via the server-component dashboard and `/api/dashboard/worklist`
 * for the future mobile client. Keep the shape minimal — these are tiles,
 * not detail views.
 */

export interface WorklistTile {
  key:
    | "new"
    | "drafts_pending"
    | "samples_followup"
    | "reorder_due"
    | "ai_cap";
  label: string;
  count: number;
  /** "0/100" / "₹12 / ₹100" style sub-line. */
  detail?: string;
  /** Click-through target. */
  href: string;
  tone: "default" | "info" | "warning" | "danger";
}

export async function loadWorklist(): Promise<WorklistTile[]> {
  const profile = await getBusinessProfile();
  const cap = await getAiCostCapStatus();

  // ── 1. Needs reply ────────────────────────────────────────────────────
  // Threads where latest message is inbound, not spam/newsletter, > 0min old.
  const [needsReplyRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(
      sql`(
        select distinct on (${emailMessages.gmailThreadId})
          ${emailMessages.gmailThreadId},
          ${emailMessages.direction},
          ${emailMessages.aiCategory}
        from ${emailMessages}
        order by ${emailMessages.gmailThreadId}, ${emailMessages.receivedAt} desc
      ) as latest`,
    )
    .where(
      sql`latest.direction = 'inbound'
          and (latest.ai_category is null or latest.ai_category not in ('spam', 'newsletter'))`,
    );
  const needsReply = needsReplyRow?.n ?? 0;

  // ── 2. Drafts pending ─────────────────────────────────────────────────
  const [draftsPendingRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(aiDrafts)
    .where(eq(aiDrafts.status, "pending"));
  const draftsPending = draftsPendingRow?.n ?? 0;

  // ── 3. Samples awaiting follow-up ────────────────────────────────────
  // Delivered status, no follow-up draft yet, AND follow_up_due_at <= now.
  const [samplesFollowupRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(sampleDispatches)
    .where(
      and(
        eq(sampleDispatches.status, "delivered"),
        isNull(sampleDispatches.followUpDraftId),
        sql`${sampleDispatches.followUpDueAt} is not null and ${sampleDispatches.followUpDueAt} <= now()`,
      ),
    );
  const samplesFollowup = samplesFollowupRow?.n ?? 0;

  // ── 4. Reorder-due (dispatched leads silent past nudgeDays) ───────────
  const nudgeDays = profile.reorderNudgeDays ?? 90;
  const cutoff = new Date(Date.now() - nudgeDays * 86_400_000);
  const [reorderDueRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(leads)
    .where(
      and(
        sql`${leads.stage} = 'dispatched'`,
        sql`${leads.lastActivityAt} < ${cutoff}`,
      ),
    );
  const reorderDue = reorderDueRow?.n ?? 0;

  // ── 5. AI cap ─────────────────────────────────────────────────────────
  const capPct = cap.unlimited
    ? 0
    : Math.min(
        100,
        Math.round((cap.spentInr / Math.max(cap.capInr, 0.01)) * 100),
      );

  return [
    {
      key: "new",
      label: "New mail",
      count: needsReply,
      href: "/inbox?filter=new",
      tone: needsReply > 0 ? "info" : "default",
    },
    {
      key: "drafts_pending",
      label: "Drafts to review",
      count: draftsPending,
      href: "/inbox?filter=draft",
      tone: draftsPending > 0 ? "info" : "default",
    },
    {
      key: "samples_followup",
      label: "Samples to follow up",
      count: samplesFollowup,
      href: "/inbox",
      tone: samplesFollowup > 0 ? "warning" : "default",
    },
    {
      key: "reorder_due",
      label: "Reorder check-ins",
      count: reorderDue,
      detail: `Won leads silent ${nudgeDays}+ days`,
      href: "/pipeline",
      tone: reorderDue > 0 ? "warning" : "default",
    },
    {
      key: "ai_cap",
      label: "AI cost today",
      count: cap.unlimited ? 0 : Math.round(cap.spentInr),
      detail: cap.unlimited
        ? "No cap set"
        : `₹${cap.spentInr.toFixed(0)} / ₹${cap.capInr.toFixed(0)} · ${capPct}%`,
      href: "/reports",
      tone:
        !cap.unlimited && cap.spentInr >= cap.capInr
          ? "danger"
          : !cap.unlimited && capPct >= 80
            ? "warning"
            : "default",
    },
  ];
}

/**
 * Recent inbound trend for the dashboard hero — emails per day, last 14 days.
 * Returned in a shape that's easy to render as a sparkline.
 */
export async function loadInboundTrend(days = 14): Promise<
  Array<{ date: string; relevant: number; cold: number; other: number }>
> {
  const since = new Date(Date.now() - days * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
      category: emailMessages.aiCategory,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.direction, "inbound"),
        gte(emailMessages.receivedAt, since),
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${emailMessages.receivedAt})`,
      emailMessages.aiCategory,
    );

  // Pivot into one row per day with three series.
  const byDay = new Map<
    string,
    { date: string; relevant: number; cold: number; other: number }
  >();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, relevant: 0, cold: 0, other: 0 });
  }
  for (const r of rows) {
    const bucket = byDay.get(r.day);
    if (!bucket) continue;
    if (r.category === "relevant") bucket.relevant += r.count;
    else if (r.category === "cold") bucket.cold += r.count;
    else bucket.other += r.count;
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
