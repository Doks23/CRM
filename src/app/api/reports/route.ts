import { NextResponse } from "next/server";
import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailMessages, leads, aiDrafts, aiCalls } from "@/db/schema";
import { auth } from "@/auth";
import { getAiCostCapStatus } from "@/lib/ai";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [emailStats] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
    inbound: sql<number>`count(*) filter (where ${emailMessages.direction} = 'inbound')`.mapWith(Number),
    outbound: sql<number>`count(*) filter (where ${emailMessages.direction} = 'outbound')`.mapWith(Number),
  }).from(emailMessages);

  const categoryBreakdown = await db.select({
    category: emailMessages.aiCategory,
    count: sql<number>`count(*)`.mapWith(Number),
  }).from(emailMessages).where(sql`${emailMessages.aiCategory} is not null`).groupBy(emailMessages.aiCategory);

  const [leadTotal] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(leads);

  const stageBreakdown = await db.select({
    stage: leads.stage,
    count: sql<number>`count(*)`.mapWith(Number),
  }).from(leads).groupBy(leads.stage);

  const [draftStats] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
    pending: sql<number>`count(*) filter (where ${aiDrafts.status} = 'pending')`.mapWith(Number),
    approved: sql<number>`count(*) filter (where ${aiDrafts.status} = 'approved')`.mapWith(Number),
    edited: sql<number>`count(*) filter (where ${aiDrafts.status} = 'edited')`.mapWith(Number),
    sent: sql<number>`count(*) filter (where ${aiDrafts.status} = 'sent')`.mapWith(Number),
    discarded: sql<number>`count(*) filter (where ${aiDrafts.status} = 'discarded')`.mapWith(Number),
  }).from(aiDrafts);

  const byStage: Record<string, number> = {};
  for (const s of stageBreakdown) {
    byStage[s.stage] = s.count;
  }

  // ── AI activity (last 24h + today's spend) ─────────────────────────────
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [aiTotals24h] = await db
    .select({
      calls: sql<number>`count(*)`.mapWith(Number),
      ok: sql<number>`count(*) filter (where ${aiCalls.status} = 'ok')`.mapWith(Number),
      errors: sql<number>`count(*) filter (where ${aiCalls.status} = 'error')`.mapWith(Number),
      capBlocked: sql<number>`count(*) filter (where ${aiCalls.status} = 'cap_blocked')`.mapWith(Number),
      classifyCalls: sql<number>`count(*) filter (where ${aiCalls.task} = 'classify' and ${aiCalls.status} = 'ok')`.mapWith(Number),
      draftCalls: sql<number>`count(*) filter (where ${aiCalls.task} = 'draft' and ${aiCalls.status} = 'ok')`.mapWith(Number),
      inputTokens: sql<number>`coalesce(sum(${aiCalls.inputTokens}), 0)`.mapWith(Number),
      outputTokens: sql<number>`coalesce(sum(${aiCalls.outputTokens}), 0)`.mapWith(Number),
      costInr24h: sql<string>`coalesce(sum(${aiCalls.costInr}) filter (where ${aiCalls.status} = 'ok'), 0)`,
      avgLatencyMs: sql<number>`coalesce(avg(${aiCalls.latencyMs}) filter (where ${aiCalls.status} = 'ok'), 0)`.mapWith(Number),
    })
    .from(aiCalls)
    .where(gte(aiCalls.createdAt, last24h));

  const recentErrors = await db
    .select({
      id: aiCalls.id,
      task: aiCalls.task,
      provider: aiCalls.provider,
      model: aiCalls.model,
      status: aiCalls.status,
      errorMessage: aiCalls.errorMessage,
      createdAt: aiCalls.createdAt,
    })
    .from(aiCalls)
    .where(
      and(
        gte(aiCalls.createdAt, last24h),
        sql`${aiCalls.status} in ('error', 'cap_blocked')`,
      ),
    )
    .orderBy(desc(aiCalls.createdAt))
    .limit(10);

  const capStatus = await getAiCostCapStatus();

  return NextResponse.json({
    emails: emailStats,
    categoryBreakdown,
    leads: { total: leadTotal.total, byStage },
    drafts: draftStats,
    ai: {
      window: "24h",
      calls: aiTotals24h.calls,
      ok: aiTotals24h.ok,
      errors: aiTotals24h.errors,
      capBlocked: aiTotals24h.capBlocked,
      classifyCalls: aiTotals24h.classifyCalls,
      draftCalls: aiTotals24h.draftCalls,
      inputTokens: aiTotals24h.inputTokens,
      outputTokens: aiTotals24h.outputTokens,
      costInr24h: parseFloat(aiTotals24h.costInr24h ?? "0"),
      avgLatencyMs: Math.round(aiTotals24h.avgLatencyMs ?? 0),
      cap: {
        unlimited: capStatus.unlimited,
        capInr: capStatus.capInr,
        spentInr: capStatus.spentInr,
        remainingInr: Number.isFinite(capStatus.remainingInr)
          ? capStatus.remainingInr
          : null,
        startOfDay: startOfDay.toISOString(),
      },
      recentErrors,
    },
  });
}
