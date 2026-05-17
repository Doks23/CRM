import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/app/sparkline";
import { Donut } from "@/components/app/donut";
import { CompanyLogo } from "@/components/app/smart-avatar";
import { Sparkles, Download, Flame, ChevronRight, Loader2, Check } from "lucide-react";
import { db } from "@/db";
import { emailMessages, leads, aiDrafts, aiCalls } from "@/db/schema";
import { PIPELINE_STAGES, normalizeStage } from "@/lib/pipeline-stages";
import { getAiCostCapStatus } from "@/lib/ai";
import { loadInboundTrend } from "@/lib/queries/worklist";
import { ExportButton } from "@/components/app/export-button";

export const dynamic = "force-dynamic";

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtPct(n: number) {
  return `${n}%`;
}
function fmtInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}
function fmtDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
function relTime(date: Date | null) {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
function stageLabel(stage: string) {
  const id = normalizeStage(stage);
  const match = PIPELINE_STAGES.find((s) => s.id === id);
  if (match) return match.label;
  if (id === "ignored") return "Ignored";
  return stage;
}
const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  gmail_direct: "Gmail Direct",
  inquiry_form: "Inquiry Form",
  referral: "Referral",
  unknown: "Other",
};
const SOURCE_COLORS = [
  "var(--stage-2)",
  "var(--primary)",
  "var(--stage-4)",
  "var(--stage-5)",
  "var(--stage-1)",
];

// ── range selector ──────────────────────────────────────────────────────────

const RANGE_OPTIONS = ["24h", "7d", "14d", "30d", "QTD"] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number];

function resolveRange(raw: string | undefined): {
  key: RangeKey;
  label: string;
  days: number;
  since: Date;
} {
  const key: RangeKey = (RANGE_OPTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as RangeKey)
    : "14d";
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  let days: number;
  let label: string;
  switch (key) {
    case "24h":
      // Today only — start of today through now.
      days = 1;
      label = "today";
      break;
    case "7d":
      days = 7;
      since.setDate(since.getDate() - 6);
      label = "last 7 days";
      break;
    case "30d":
      days = 30;
      since.setDate(since.getDate() - 29);
      label = "last 30 days";
      break;
    case "QTD": {
      const now = new Date();
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      since.setMonth(qStartMonth, 1);
      const ms = Date.now() - since.getTime();
      days = Math.max(1, Math.floor(ms / 86_400_000) + 1);
      label = "quarter to date";
      break;
    }
    case "14d":
    default:
      days = 14;
      since.setDate(since.getDate() - 13);
      label = "last 14 days";
      break;
  }
  return { key, label, days, since };
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = resolveRange(rangeParam);
  const sinceDate = range.since;
  const windowDays = range.days;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    [emailStatsRow],
    [threadStatsRow],
    trend14d,
    stageRows,
    [draftStatsRow],
    sourceRows,
    capStatus,
    [aiTodayRow],
    aiDailyRows,
    outboundDailyRows,
    [latencyRow],
    topLeadsRaw,
  ] = await Promise.all([
    db
      .select({
        inbound: sql<number>`count(*) filter (where ${emailMessages.direction} = 'inbound')`.mapWith(Number),
        outbound: sql<number>`count(*) filter (where ${emailMessages.direction} = 'outbound')`.mapWith(Number),
      })
      .from(emailMessages)
      .where(gte(emailMessages.receivedAt, sinceDate)),

    db
      .select({
        inboundThreads: sql<number>`count(distinct ${emailMessages.gmailThreadId}) filter (where ${emailMessages.direction} = 'inbound')`.mapWith(Number),
        repliedThreads: sql<number>`count(distinct ${emailMessages.gmailThreadId}) filter (where ${emailMessages.direction} = 'outbound')`.mapWith(Number),
      })
      .from(emailMessages)
      .where(gte(emailMessages.receivedAt, sinceDate)),

    loadInboundTrend(windowDays),

    db
      .select({
        stage: leads.stage,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.stage),

    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        approved: sql<number>`count(*) filter (where ${aiDrafts.status} = 'approved')`.mapWith(Number),
        edited: sql<number>`count(*) filter (where ${aiDrafts.status} = 'edited')`.mapWith(Number),
        sent: sql<number>`count(*) filter (where ${aiDrafts.status} = 'sent')`.mapWith(Number),
        discarded: sql<number>`count(*) filter (where ${aiDrafts.status} = 'discarded')`.mapWith(Number),
      })
      .from(aiDrafts)
      .where(gte(aiDrafts.createdAt, sinceDate)),

    db
      .select({
        source: leads.source,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.source),

    getAiCostCapStatus(),

    db
      .select({
        calls: sql<number>`count(*)`.mapWith(Number),
        tokens: sql<number>`coalesce(sum(${aiCalls.inputTokens} + ${aiCalls.outputTokens}), 0)`.mapWith(Number),
        costInr: sql<string>`coalesce(sum(${aiCalls.costInr}) filter (where ${aiCalls.status} = 'ok'), 0)`,
      })
      .from(aiCalls)
      .where(gte(aiCalls.createdAt, startOfDay)),

    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${aiCalls.createdAt}), 'YYYY-MM-DD')`,
        cost: sql<string>`coalesce(sum(${aiCalls.costInr}) filter (where ${aiCalls.status} = 'ok'), 0)`,
      })
      .from(aiCalls)
      .where(gte(aiCalls.createdAt, sinceDate))
      .groupBy(sql`date_trunc('day', ${aiCalls.createdAt})`),

    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.direction, "outbound"),
          gte(emailMessages.receivedAt, sinceDate),
        ),
      )
      .groupBy(sql`date_trunc('day', ${emailMessages.receivedAt})`),

    db
      .select({
        avgLatencyMs: sql<number | null>`
          (
            select avg(extract(epoch from (fo.t - fi.t)) * 1000)
            from (
              select gmail_thread_id, min(received_at) as t
              from email_message
              where direction = 'inbound'
                and received_at >= ${sinceDate}
              group by gmail_thread_id
            ) fi
            join (
              select gmail_thread_id, min(received_at) as t
              from email_message
              where direction = 'outbound'
                and received_at >= ${sinceDate}
              group by gmail_thread_id
            ) fo using (gmail_thread_id)
            where fo.t > fi.t
          )
        `.mapWith(Number),
      })
      .from(sql`(select 1) as dummy`),

    db
      .select({
        id: leads.id,
        company: leads.company,
        contactName: leads.contactName,
        stage: leads.stage,
        lastActivityAt: leads.lastActivityAt,
        messageCount: sql<number>`count(${emailMessages.id})`.mapWith(Number),
      })
      .from(leads)
      .leftJoin(emailMessages, eq(emailMessages.leadId, leads.id))
      .where(isNull(leads.deletedAt))
      .groupBy(leads.id)
      .orderBy(desc(sql`count(${emailMessages.id})`))
      .limit(6),
  ]);

  // ── derived ────────────────────────────────────────────────────────────────

  const totalInbound = emailStatsRow?.inbound ?? 0;
  const totalOutbound = emailStatsRow?.outbound ?? 0;
  const replyRate =
    totalInbound > 0 ? Math.round((totalOutbound / totalInbound) * 100) : 0;
  const inboundThreads = threadStatsRow?.inboundThreads ?? 0;
  const repliedThreads = threadStatsRow?.repliedThreads ?? 0;
  const avgLatencyMs = latencyRow?.avgLatencyMs ?? null;

  // Normalize any legacy enum values onto the current pipeline ids so old
  // rows aren't silently dropped from totals.
  const byStage: Record<string, number> = {};
  for (const r of stageRows) {
    const key = normalizeStage(r.stage);
    byStage[key] = (byStage[key] ?? 0) + r.count;
  }
  const totalLeads = stageRows.reduce((s, r) => {
    const stage = normalizeStage(r.stage);
    if (stage === "ignored") return s;
    return s + r.count;
  }, 0);

  // Funnel shows non-cumulative lead count per stage.
  const PIPELINE_IDS = PIPELINE_STAGES.map((s) => s.id);
  const funnel = PIPELINE_STAGES.map((s) => ({
    label: s.label,
    value: byStage[s.id] ?? 0,
    color: s.color,
  }));
  const conversionPct =
    funnel[0].value > 0
      ? ((funnel[funnel.length - 1].value / funnel[0].value) * 100).toFixed(1)
      : "0";

  const ds = draftStatsRow ?? {
    total: 0,
    approved: 0,
    edited: 0,
    sent: 0,
    discarded: 0,
  };
  const totalFinalized = ds.sent + ds.approved + ds.edited + ds.discarded;
  const approvedPct =
    totalFinalized > 0
      ? Math.round(((ds.sent + ds.approved) / totalFinalized) * 100)
      : 0;
  const editedPct =
    totalFinalized > 0 ? Math.round((ds.edited / totalFinalized) * 100) : 0;
  const discardedPct =
    totalFinalized > 0
      ? Math.round((ds.discarded / totalFinalized) * 100)
      : 0;

  const todayCost = parseFloat(aiTodayRow?.costInr ?? "0");
  const capInr = capStatus.capInr;
  const capPct =
    !capStatus.unlimited && capInr > 0
      ? Math.min(100, (todayCost / capInr) * 100)
      : 0;

  const aiDailyCostMap = Object.fromEntries(
    aiDailyRows.map((r) => [r.day, parseFloat(r.cost)]),
  );
  const aiDailyCosts = Array.from({ length: windowDays }, (_, i) => {
    const d = new Date(sinceDate.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return aiDailyCostMap[key] ?? 0;
  });

  const outboundDailyMap = Object.fromEntries(
    outboundDailyRows.map((r) => [r.day, r.count]),
  );
  const inboundDaily = trend14d.map(
    (d) => d.relevant + d.cold + d.other,
  );
  const outboundDaily = Array.from({ length: windowDays }, (_, i) => {
    const d = new Date(sinceDate.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return outboundDailyMap[key] ?? 0;
  });

  const inboundTotalWindow = inboundDaily.reduce((s, n) => s + n, 0);
  const outboundTotalWindow = outboundDaily.reduce((s, n) => s + n, 0);
  const replyRateWindow =
    inboundThreads > 0
      ? Math.round((repliedThreads / inboundThreads) * 100)
      : 0;

  // Split the window in half for trend deltas. For very short windows the
  // half-vs-half comparison is noisy but still works.
  const halfPoint = Math.max(1, Math.floor(windowDays / 2));
  const inboundHalf1 = inboundDaily.slice(0, halfPoint).reduce((s, n) => s + n, 0);
  const inboundHalf2 = inboundDaily.slice(halfPoint).reduce((s, n) => s + n, 0);
  const inboundDelta =
    inboundHalf1 > 0
      ? Math.round(((inboundHalf2 - inboundHalf1) / inboundHalf1) * 100)
      : 0;

  const sources = sourceRows
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({
      label: SOURCE_LABELS[s.source ?? "unknown"] ?? "Other",
      value: s.count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }));
  const sourcesTotal = sources.reduce((s, x) => s + x.value, 0);

  // Leaderboard per-lead trend
  const topLeadIds = topLeadsRaw.map((l) => l.id);
  const leadTrendRows =
    topLeadIds.length > 0
      ? await db
          .select({
            leadId: emailMessages.leadId,
            day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(emailMessages)
          .where(
            and(
              inArray(emailMessages.leadId, topLeadIds as [string, ...string[]]),
              gte(emailMessages.receivedAt, sinceDate),
            ),
          )
          .groupBy(
            emailMessages.leadId,
            sql`date_trunc('day', ${emailMessages.receivedAt})`,
          )
      : [];

  const trendByLead = new Map<string, number[]>();
  for (const id of topLeadIds) {
    trendByLead.set(id, Array(windowDays).fill(0));
  }
  for (const r of leadTrendRows) {
    const arr = trendByLead.get(r.leadId ?? "");
    if (!arr) continue;
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(sinceDate.getTime() + i * 86_400_000);
      if (d.toISOString().slice(0, 10) === r.day) {
        arr[i] = r.count;
      }
    }
  }

  const topLeads = topLeadsRaw.map((l) => ({
    ...l,
    trend: trendByLead.get(l.id) ?? Array(windowDays).fill(0),
  }));

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <ReportsHero range={range.key} label={range.label} />
      <BigStats
        totalInbound={totalInbound}
        replyRate={replyRateWindow}
        draftTotal={ds.total}
        todayCost={todayCost}
        inboundDelta={inboundDelta}
        inboundDaily={inboundDaily}
        aiDailyCosts={aiDailyCosts}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3.5">
        <FunnelCard
          funnel={funnel}
          conversionPct={conversionPct}
        />
        <InboxHealth
          inboundDaily={inboundDaily}
          outboundDaily={outboundDaily}
          totalInbound={inboundTotalWindow}
          totalReplied={repliedThreads}
          replyRate={replyRateWindow}
          windowDays={windowDays}
          rangeLabel={range.label}
          avgLatencyMs={avgLatencyMs}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <SourceMix sources={sources} total={sourcesTotal} totalLeads={totalLeads} />
        <AICost
          todayCost={todayCost}
          capInr={capInr}
          capPct={capPct}
          unlimited={capStatus.unlimited}
          calls={aiTodayRow?.calls ?? 0}
          tokens={aiTodayRow?.tokens ?? 0}
          sparkData={aiDailyCosts}
        />
        <DraftQuality
          approvedPct={approvedPct}
          editedPct={editedPct}
          discardedPct={discardedPct}
          total={ds.total}
        />
      </div>
      <Leaderboard topLeads={topLeads} rangeKey={range.key} />
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function ReportsHero({ range, label }: { range: RangeKey; label: string }) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-3">
      <div>
        <h1 className="serif text-[30px] leading-tight -tracking-[0.015em]">
          Reports
        </h1>
        <div className="text-[14px] text-muted-foreground mt-1">
          Inbox health, lead funnel, AI quality and cost ·{" "}
          <em className="serif italic text-foreground">{label}</em>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center bg-card border border-border rounded-lg p-0.5">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={`/reports?range=${r}`}
              scroll={false}
              className={`h-7 px-3 text-[13px] rounded-md font-medium inline-flex items-center ${
                r === range
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
        <ExportButton range={range} />
      </div>
    </div>
  );
}

function BigStats({
  totalInbound,
  replyRate,
  draftTotal,
  todayCost,
  inboundDelta,
  inboundDaily,
  aiDailyCosts,
}: {
  totalInbound: number;
  replyRate: number;
  draftTotal: number;
  todayCost: number;
  inboundDelta: number;
  inboundDaily: number[];
  aiDailyCosts: number[];
}) {
  const stats = [
    {
      label: "Emails handled",
      v: String(totalInbound),
      delta: inboundDelta !== 0 ? `${inboundDelta > 0 ? "+" : ""}${inboundDelta}%` : "—",
      good: inboundDelta >= 0,
      spark: inboundDaily,
    },
    {
      label: "Reply rate",
      v: fmtPct(replyRate),
      delta: "—",
      good: true,
      spark: inboundDaily.map((n) => Math.min(n, 20)),
    },
    {
      label: "Drafts generated",
      v: String(draftTotal),
      delta: "—",
      good: true,
      spark: aiDailyCosts.map((c) => Math.round(c * 10)),
    },
    {
      label: "AI spend (today)",
      v: fmtInr(todayCost),
      delta: "—",
      good: true,
      spark: aiDailyCosts,
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 gap-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[12px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              {s.label}
            </span>
            <span
              className={`text-[12px] font-semibold ${
                s.delta === "—"
                  ? "text-muted-foreground"
                  : s.good
                    ? "text-pos"
                    : "text-warn"
              }`}
            >
              {s.delta}
            </span>
          </div>
          <div className="serif tabular text-[36px] leading-none">{s.v}</div>
          <Sparkline data={s.spark} width={240} height={32} />
        </Card>
      ))}
    </div>
  );
}

function FunnelCard({
  funnel,
  conversionPct,
}: {
  funnel: Array<{ label: string; value: number; color: string }>;
  conversionPct: string;
}) {
  const maxVal = funnel[0]?.value || 1;
  return (
    <Card className="p-5 gap-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="font-heading text-[15px] font-semibold">
            Conversion funnel
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5">
            {funnel[0]?.label ?? ""} → {funnel[funnel.length - 1]?.label ?? ""} ·{" "}
            <strong className="text-foreground/85">{conversionPct}% conversion</strong>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="rounded">
            Volume
          </Badge>
        </div>
      </div>
      <div className="space-y-2">
        {funnel.map((s, i) => {
          const pct = (s.value / maxVal) * 100;
          const prev = i > 0 ? funnel[i - 1].value : s.value;
          const drop = i > 0 && prev > 0 ? Math.round((1 - s.value / prev) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-[100px] shrink-0 flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[13.5px] font-medium">{s.label}</span>
              </div>
              <div className="flex-1 relative h-7 bg-surface-2 rounded-md overflow-hidden">
                <div
                  className="h-full flex items-center pl-2.5 text-white tabular text-[13px] font-semibold"
                  style={{ width: `${Math.max(pct, 2)}%`, background: s.color, opacity: 0.9 }}
                >
                  {s.value > 0 ? s.value : ""}
                </div>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 tabular text-[12px] font-medium text-muted-foreground">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div
                className={`w-16 text-right text-[12px] ${
                  i > 0
                    ? drop > 50
                      ? "text-warn"
                      : "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                {i > 0 ? `−${drop}%` : "baseline"}
              </div>
            </div>
          );
        })}
      </div>
      {funnel[0].value === 0 && (
        <div className="mt-2 flex gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-surface-2 text-[13px] text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
          <div>No leads yet. Start syncing your inbox to populate the funnel.</div>
        </div>
      )}
    </Card>
  );
}

function InboxHealth({
  inboundDaily,
  outboundDaily,
  totalInbound,
  totalReplied,
  replyRate,
  windowDays,
  rangeLabel,
  avgLatencyMs,
}: {
  inboundDaily: number[];
  outboundDaily: number[];
  totalInbound: number;
  totalReplied: number;
  replyRate: number;
  windowDays: number;
  rangeLabel: string;
  avgLatencyMs: number | null;
}) {
  const max = Math.max(...inboundDaily, 1);
  const labels = inboundDaily.map((_, i) => {
    const d = new Date(Date.now() - (windowDays - 1 - i) * 86_400_000);
    return d.getDate();
  });
  return (
    <Card className="p-5 gap-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="font-heading text-[15px] font-semibold">
            Inbox health
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5">
            Inbound · Replies sent · per day · {rangeLabel}
          </div>
        </div>
        <div className="flex gap-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" /> Replies
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-surface-3" /> Inbound
          </div>
        </div>
      </div>
      <div className="flex items-end gap-1 h-[130px]">
        {inboundDaily.map((v, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <div className="w-full flex items-end h-[110px] relative">
              <div
                className="absolute bottom-0 w-full rounded bg-surface-3"
                style={{ height: `${(v / max) * 100}%` }}
              />
              <div
                className="absolute bottom-0 w-full rounded bg-primary/90"
                style={{ height: `${((outboundDaily[i] ?? 0) / max) * 100}%` }}
              />
            </div>
            <div className="text-[10.5px] text-muted-foreground">{labels[i]}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-3 border-t border-border grid grid-cols-2 gap-2 text-[13px]">
        <KV k="Total inbound" v={String(totalInbound)} />
        <KV k="Total replied" v={String(totalReplied)} />
        <KV k="Reply rate" v={fmtPct(replyRate)} pos={replyRate >= 70} />
        <KV k="Avg latency" v={fmtDuration(avgLatencyMs)} />
      </div>
    </Card>
  );
}

function KV({ k, v, pos }: { k: string; v: string; pos?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={`tabular font-semibold ${
          pos ? "text-pos" : "text-foreground"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

function SourceMix({
  sources,
  total,
  totalLeads,
}: {
  sources: Array<{ label: string; value: number; color: string }>;
  total: number;
  totalLeads: number;
}) {
  const displaySources = sources.length > 0
    ? sources
    : [{ label: "No data", value: 1, color: "var(--muted)" }];
  return (
    <Card className="p-5 gap-3">
      <div className="font-heading text-[15px] font-semibold">
        Lead source mix
      </div>
      <div className="flex items-center gap-4">
        <Donut segments={displaySources} size={120} thickness={16}>
          <span className="serif tabular text-[26px]">{totalLeads}</span>
          <span className="text-[11px] text-muted-foreground">leads</span>
        </Donut>
        <div className="flex-1 space-y-1.5">
          {sources.length === 0 ? (
            <div className="text-[13px] text-muted-foreground">No leads yet</div>
          ) : (
            sources.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-[13px]">
                <span
                  className="size-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="flex-1 text-foreground/85">{s.label}</span>
                <span className="tabular font-semibold">{s.value}</span>
                <span className="tabular text-muted-foreground w-8 text-right">
                  {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function AICost({
  todayCost,
  capInr,
  capPct,
  unlimited,
  calls,
  tokens,
  sparkData,
}: {
  todayCost: number;
  capInr: number;
  capPct: number;
  unlimited: boolean;
  calls: number;
  tokens: number;
  sparkData: number[];
}) {
  const underCap = unlimited || capPct < 100;
  return (
    <Card className="p-5 gap-3">
      <div className="flex items-baseline justify-between">
        <div className="font-heading text-[15px] font-semibold">
          AI cost · daily
        </div>
        <Badge className={underCap ? "bg-pos-tint text-pos border-transparent" : "bg-warn-tint text-warn border-transparent"}>
          {unlimited ? "no cap" : underCap ? "under cap" : "at cap"}
        </Badge>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="serif tabular text-[30px]">{fmtInr(todayCost)}</span>
        <span className="text-[13px] text-muted-foreground">
          {unlimited ? "today · no cap set" : `of ${fmtInr(capInr)} today`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div
            className={`h-full ${capPct >= 90 ? "bg-warn" : "bg-primary"}`}
            style={{ width: `${capPct.toFixed(1)}%` }}
          />
        </div>
      )}
      <Sparkline data={sparkData} width={300} height={56} />
      <div className="text-[12px] text-muted-foreground flex justify-between">
        <span>
          {calls} call{calls !== 1 ? "s" : ""} · {(tokens / 1000).toFixed(1)}k tokens today
        </span>
        <span>
          {calls > 0 ? fmtInr(todayCost / calls) : "—"} / call
        </span>
      </div>
    </Card>
  );
}

function DraftQuality({
  approvedPct,
  editedPct,
  discardedPct,
  total,
}: {
  approvedPct: number;
  editedPct: number;
  discardedPct: number;
  total: number;
}) {
  const metrics = [
    {
      label: "Approved as-is",
      v: total > 0 ? fmtPct(approvedPct) : "—",
      tone: approvedPct >= 60 ? "pos" : "neutral",
      sub: `${total} total drafts`,
    },
    {
      label: "Edited & sent",
      v: total > 0 ? fmtPct(editedPct) : "—",
      tone: "neutral",
      sub: "user edits applied",
    },
    {
      label: "Discarded",
      v: total > 0 ? fmtPct(discardedPct) : "—",
      tone: discardedPct > 20 ? "warn" : "neutral",
      sub: discardedPct > 20 ? "above 20%" : "within range",
    },
    {
      label: "Avg confidence",
      v: "—",
      tone: "neutral",
      sub: "not tracked yet",
    },
  ];
  return (
    <Card className="p-5 gap-3">
      <div className="font-heading text-[15px] font-semibold">Draft quality</div>
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="px-3 py-2.5 bg-surface-2 rounded-[10px]">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {m.label}
            </div>
            <div
              className={`serif tabular text-[22px] mt-0.5 ${
                m.tone === "pos"
                  ? "text-pos"
                  : m.tone === "warn"
                    ? "text-warn"
                    : "text-foreground"
              }`}
            >
              {m.v}
            </div>
            <div className="text-[11.5px] text-muted-foreground">{m.sub}</div>
          </div>
        ))}
      </div>
      {total === 0 && (
        <div className="mt-1 px-3 py-2.5 rounded-[10px] bg-surface-2 text-[12.5px] text-muted-foreground leading-[1.45]">
          No drafts yet. Once Saathi generates replies, quality metrics will appear here.
        </div>
      )}
    </Card>
  );
}

function Leaderboard({
  topLeads,
  rangeKey,
}: {
  topLeads: Array<{
    id: string;
    company: string | null;
    contactName: string | null;
    stage: string;
    lastActivityAt: Date;
    messageCount: number;
    trend: number[];
  }>;
  rangeKey: RangeKey;
}) {
  return (
    <Card className="p-0 gap-0">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
        <span className="font-heading text-[15px] font-semibold">
          Top accounts · by activity
        </span>
        <span className="text-[13px] text-muted-foreground">
          {topLeads.length} shown
        </span>
        <Button variant="ghost" size="xs" className="ml-auto">
          View all <ChevronRight className="size-3" />
        </Button>
      </div>
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_0.5fr] px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground border-b border-border">
        <div>Account</div>
        <div>Stage</div>
        <div>Messages</div>
        <div>Last touch</div>
        <div>{rangeKey} trend</div>
        <div />
      </div>
      {topLeads.length === 0 ? (
        <div className="px-5 py-8 text-center text-[14px] text-muted-foreground">
          No leads yet.
        </div>
      ) : (
        topLeads.map((r) => {
          const name = r.company || r.contactName || r.id.slice(0, 8);
          const isHot = r.messageCount > 10;
          const isStuck =
            r.lastActivityAt &&
            Date.now() - r.lastActivityAt.getTime() > 7 * 86_400_000 &&
            !["dispatched", "ignored"].includes(r.stage);
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_0.5fr] items-center px-5 py-2.5 text-[14px] [&:not(:last-child)]:border-b border-border"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyLogo name={name} size={26} />
                <span className="font-semibold truncate">{name}</span>
                {isHot && (
                  <span className="inline-flex items-center gap-0.5 h-4 px-1 rounded bg-neg-tint text-neg text-[10.5px] font-semibold">
                    <Flame className="size-2.5" strokeWidth={2} /> HOT
                  </span>
                )}
                {isStuck && (
                  <span className="h-4 px-1 rounded bg-warn-tint text-warn text-[10.5px] font-semibold inline-flex items-center">
                    STUCK
                  </span>
                )}
              </div>
              <div className="text-[13px] text-muted-foreground">{stageLabel(r.stage)}</div>
              <div className="tabular text-muted-foreground">{r.messageCount}</div>
              <div className="text-muted-foreground">{relTime(r.lastActivityAt)} ago</div>
              <div>
                <Sparkline
                  data={r.trend.length > 0 ? r.trend : [0]}
                  width={90}
                  height={26}
                  strokeWidth={1.4}
                />
              </div>
              <div className="text-right">
                <ChevronRight className="size-3.5 text-muted-foreground inline" />
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}
