import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  Sparkles,
  ChevronRight,
  Send,
  Pencil,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/db";
import { aiCalls, aiDrafts, emailMessages, leads } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SmartAvatar } from "@/components/app/smart-avatar";
import { Sparkline } from "@/components/app/sparkline";
import { StagePill } from "@/components/app/stage-pill";
import { getAiCostCapStatus } from "@/lib/ai";
import { loadWorklist, loadInboundTrend } from "@/lib/queries/worklist";

export const dynamic = "force-dynamic";

const STAGE_META: Record<string, { label: string; color: string }> = {
  new:          { label: "New",          color: "var(--stage-1)" },
  needs_review: { label: "New",          color: "var(--stage-1)" },
  qualified:    { label: "Qualified",    color: "var(--stage-3)" },
  info_sent:    { label: "Info Sent",    color: "var(--stage-4)" },
  negotiation:  { label: "Negotiation",  color: "var(--stage-5)" },
  po_received:  { label: "PO Received",  color: "var(--stage-6)" },
  dispatched:   { label: "Dispatched",   color: "var(--stage-2)" },
  won:          { label: "Won",          color: "var(--stage-7)" },
  lost:         { label: "Lost",         color: "var(--warn)"    },
};

const PIPELINE_EXCLUDED = new Set(["won", "lost", "nurture", "needs_review"]);

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [tiles, trend, cap] = await Promise.all([
    loadWorklist(),
    loadInboundTrend(14),
    getAiCostCapStatus(),
  ]);

  const tileMap = new Map(tiles.map((t) => [t.key, t]));
  const needsReply = tileMap.get("needs_reply")?.count ?? 0;
  const draftsPending = tileMap.get("drafts_pending")?.count ?? 0;
  const samplesFollowup = tileMap.get("samples_followup")?.count ?? 0;
  const reorderDue = tileMap.get("reorder_due")?.count ?? 0;

  // 7-day spark using real inbound trend
  const last7 = trend.slice(-7);
  const relevantSpark = last7.map((d) => d.relevant);
  const totalSpark = last7.map((d) => d.relevant + d.cold + d.other);

  // Focus leads — pending AI drafts
  const focusLeads = await db
    .select({
      leadId:        leads.id,
      contactName:   leads.contactName,
      company:       leads.company,
      leadType:      leads.leadType,
      stage:         leads.stage,
      lastActivityAt: leads.lastActivityAt,
      draftId:       aiDrafts.id,
      draftBody:     aiDrafts.draftBody,
      confidence:    emailMessages.aiConfidence,
      aiReason:      emailMessages.aiReason,
      detectedLang:  emailMessages.detectedLanguage,
      gmailThreadId: emailMessages.gmailThreadId,
      subject:       emailMessages.subject,
    })
    .from(aiDrafts)
    .innerJoin(leads, eq(aiDrafts.leadId, leads.id))
    .leftJoin(emailMessages, eq(emailMessages.id, aiDrafts.inReplyToMessageId))
    .where(eq(aiDrafts.status, "pending"))
    .orderBy(desc(leads.lastActivityAt))
    .limit(3);

  // Stage breakdown for PipelinePulse
  const stageRows = await db
    .select({
      stage: leads.stage,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(leads)
    .groupBy(leads.stage);

  const totalLeads = stageRows.reduce((s, r) => s + r.count, 0);
  const activePipelineLeads = stageRows
    .filter((r) => !PIPELINE_EXCLUDED.has(r.stage))
    .reduce((s, r) => s + r.count, 0);

  // Recent AI calls for SaathiActivity
  const recentCalls = await db
    .select({
      id:        aiCalls.id,
      task:      aiCalls.task,
      status:    aiCalls.status,
      provider:  aiCalls.provider,
      model:     aiCalls.model,
      costInr:   aiCalls.costInr,
      latencyMs: aiCalls.latencyMs,
      createdAt: aiCalls.createdAt,
      leadId:    aiCalls.leadId,
    })
    .from(aiCalls)
    .orderBy(desc(aiCalls.createdAt))
    .limit(8);

  // Total inbound/outbound for InboxPulse stats
  const [emailTotals] = await db
    .select({
      inbound:  sql<number>`count(*) filter (where ${emailMessages.direction} = 'inbound')`.mapWith(Number),
      outbound: sql<number>`count(*) filter (where ${emailMessages.direction} = 'outbound')`.mapWith(Number),
    })
    .from(emailMessages);

  const replyRate = emailTotals.inbound > 0
    ? Math.round((emailTotals.outbound / emailTotals.inbound) * 100)
    : 0;

  // Totals for trend legend
  const totalRelevant = trend.reduce((s, d) => s + d.relevant, 0);
  const totalCold     = trend.reduce((s, d) => s + d.cold,     0);
  const totalOther    = trend.reduce((s, d) => s + d.other,    0);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Hero */}
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h1 className="serif text-[32px] font-normal leading-[1.1] -tracking-[0.015em]">
            {greeting}, {firstName}.
          </h1>
          <span className="text-[14px] text-muted-foreground">
            <em className="serif italic text-foreground text-[15.5px]">
              {needsReply === 0 ? "No threads" : needsReply === 1 ? "One thread" : `${needsReply} threads`}
            </em>{" "}
            unread · {activePipelineLeads} active in pipeline
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="bg-card">
            <span className="inline-block size-1.5 rounded-full bg-warn" />
            {dateLabel}
          </Badge>
          <div className="w-px h-[18px] bg-border" />
          <form action="/api/gmail/sync" method="POST">
            <Button variant="outline" size="sm" type="submit">
              <RefreshCw className="size-3.5" /> Re-sync
            </Button>
          </form>
          <Link href="/reports" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="size-3.5" /> Reports
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          {
            label: "Needs reply",
            value: String(needsReply),
            delta: needsReply > 0 ? "action needed" : "all clear",
            deltaCls: needsReply > 0 ? "bg-warn-tint text-warn" : "bg-muted text-muted-foreground",
            sub: needsReply > 0 ? "check inbox" : "inbox clear",
            spark: relevantSpark,
            color: "var(--warn)",
          },
          {
            label: "Drafts to review",
            value: String(draftsPending),
            delta: "AI ready",
            deltaCls: "bg-draft-tint text-draft-ink",
            sub: draftsPending > 0 ? "awaiting approval" : "no pending drafts",
            spark: totalSpark,
            color: "var(--primary)",
          },
          {
            label: "Samples follow-up",
            value: String(samplesFollowup),
            delta: samplesFollowup > 0 ? "due now" : "on track",
            deltaCls: samplesFollowup > 0 ? "bg-neg-tint text-neg" : "bg-muted text-muted-foreground",
            sub: "delivered, waiting",
            spark: Array(7).fill(samplesFollowup),
            color: "var(--stage-6)",
          },
          {
            label: "Reorder check-ins",
            value: String(reorderDue),
            delta: tileMap.get("reorder_due")?.detail ?? "90d+",
            deltaCls: "bg-info-tint text-info",
            sub: "won leads gone quiet",
            spark: Array(7).fill(reorderDue),
            color: "var(--stage-1)",
          },
          {
            label: "AI spend today",
            value: cap.unlimited ? "–" : `₹${cap.spentInr.toFixed(2)}`,
            delta: cap.unlimited ? "no cap" : `${Math.round((cap.spentInr / Math.max(cap.capInr, 0.01)) * 100)}% of cap`,
            deltaCls: "bg-muted text-muted-foreground",
            sub: cap.unlimited ? "unlimited" : `cap ₹${cap.capInr.toFixed(0)}`,
            spark: Array(7).fill(cap.spentInr),
            color: "var(--muted-foreground)",
          },
        ].map((k) => (
          <Card key={k.label} className="p-4 gap-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              {k.label}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="serif tabular text-[42px] leading-none font-normal">{k.value}</span>
              <span className={`inline-flex items-center h-[18px] px-1.5 rounded text-[10px] font-semibold whitespace-nowrap ${k.deltaCls}`}>
                {k.delta}
              </span>
            </div>
            <div className="text-[11.5px] text-muted-foreground">{k.sub}</div>
            <Sparkline data={k.spark} width={240} height={28} color={k.color} />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-3.5 items-start">
        <div className="space-y-3.5">
          {/* Focus card */}
          <Card className="p-0 gap-0 bg-gradient-to-b from-[oklch(0.98_0.012_80)] to-card">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <span className="inline-flex size-[22px] rounded-[7px] bg-gradient-to-br from-primary to-[oklch(0.55_0.13_150)] items-center justify-center text-primary-foreground shadow-[0_4px_10px_oklch(0.48_0.11_162/0.35)]">
                <Sparkles className="size-3.5" strokeWidth={1.8} />
              </span>
              <span className="font-heading text-[14px] font-semibold">Today&apos;s focus</span>
              {draftsPending > 0 && (
                <span className="inline-flex items-center gap-1.5 h-[18px] px-1.5 rounded bg-draft-tint text-draft-ink text-[10px] font-semibold">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {draftsPending} draft{draftsPending !== 1 ? "s" : ""} ready
                </span>
              )}
              <div className="ml-auto flex gap-1.5">
                <Link href="/inbox" className={buttonVariants({ variant: "ghost", size: "xs" })}>
                  View all {needsReply}
                </Link>
                <Link href="/inbox?filter=needs_reply" className={buttonVariants({ variant: "ghost", size: "xs" })}>
                  <Filter className="size-3" /> Filter
                </Link>
              </div>
            </div>
            {focusLeads.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
                No pending drafts — you&apos;re all caught up!
              </div>
            ) : (
              <div>
                {focusLeads.map((r) => {
                  const confPct = r.confidence ? Math.round(parseFloat(r.confidence) * 100) : null;
                  const ageMs = Date.now() - new Date(r.lastActivityAt).getTime();
                  const ageH = Math.floor(ageMs / 3_600_000);
                  const ageLabel = ageH < 1 ? "just now" : ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
                  const typeLabel = (r.leadType ?? "inquiry").replace(/_/g, " ");
                  return (
                    <div
                      key={r.draftId}
                      className="grid grid-cols-[44px_1fr_auto] gap-3.5 px-5 py-3.5 [&:not(:last-child)]:border-b border-border"
                    >
                      <SmartAvatar name={r.contactName ?? r.leadId} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13.5px] font-semibold">{r.contactName ?? r.leadId}</span>
                          {r.company && (
                            <span className="text-[12.5px] text-muted-foreground">· {r.company}</span>
                          )}
                          <Badge variant="outline" className="text-[10.5px] font-semibold rounded capitalize">
                            {typeLabel}
                          </Badge>
                          {confPct !== null && (
                            <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded bg-draft-tint text-draft-ink text-[10.5px] font-semibold whitespace-nowrap">
                              <span className="size-1.5 rounded-full bg-primary" />
                              {confPct}% confidence
                            </span>
                          )}
                        </div>
                        {r.draftBody && (
                          <p className="serif italic text-[13px] text-foreground/85 leading-[1.45] mb-2 line-clamp-2">
                            &ldquo;{r.draftBody.slice(0, 180)}&hellip;&rdquo;
                          </p>
                        )}
                        {r.aiReason && (
                          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                            <Sparkles className="size-3 text-primary" strokeWidth={1.6} />
                            <span className="line-clamp-1">{r.aiReason}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[11px] text-muted-foreground tabular">
                          {ageLabel} · <StagePill label={r.stage} className="text-[10px]" dotSize={5} />
                        </span>
                        <div className="flex gap-1.5">
                          {r.gmailThreadId && (
                            <>
                              <Link
                                href={`/inbox/${r.gmailThreadId}`}
                                className={buttonVariants({ variant: "ghost", size: "xs" })}
                              >
                                <Pencil className="size-3" /> Edit
                              </Link>
                              <Link
                                href={`/inbox/${r.gmailThreadId}`}
                                className={buttonVariants({ size: "xs", className: "bg-primary text-primary-foreground hover:bg-primary/90 px-3" })}
                              >
                                <Send className="size-3" strokeWidth={2} /> Approve &amp; send
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Inbox pulse */}
          <Card className="p-5 gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-heading text-[14px] font-semibold">Inbox pulse</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  Inbound threads · last 14 days
                </div>
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <Legend color="var(--primary)" label="Relevant" v={String(totalRelevant)} />
                <Legend color="var(--muted-foreground)" label="Other" v={String(totalOther)} />
                <Legend color="var(--surface-3)" label="Cold" v={String(totalCold)} />
              </div>
            </div>
            <InboxPulseChart trend={trend} />
            <div className="mt-2 pt-3 border-t border-border grid grid-cols-4 gap-2">
              <Stat label="Reply rate"   v={`${replyRate}%`}              delta="" />
              <Stat label="Inbound"      v={String(emailTotals.inbound)}  delta="" />
              <Stat label="Replied"      v={String(emailTotals.outbound)} delta="" />
              <Stat label="Leads total"  v={String(totalLeads)}           delta="" />
            </div>
          </Card>
        </div>

        <div className="space-y-3.5">
          {/* Pipeline pulse */}
          <Card className="p-5 gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-heading text-[14px] font-semibold">Pipeline pulse</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {totalLeads} lead{totalLeads !== 1 ? "s" : ""} across {stageRows.length} stage{stageRows.length !== 1 ? "s" : ""}
                </div>
              </div>
              <Link href="/pipeline" className={buttonVariants({ variant: "ghost", size: "xs" })}>
                Open pipeline <ChevronRight className="size-3" />
              </Link>
            </div>
            {totalLeads === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">No leads yet</p>
            ) : (
              <>
                <div className="flex h-3 rounded-full overflow-hidden">
                  {stageRows.map((s) => (
                    <div
                      key={s.stage}
                      style={{ flex: s.count, background: STAGE_META[s.stage]?.color ?? "var(--muted)" }}
                      title={`${STAGE_META[s.stage]?.label ?? s.stage}: ${s.count}`}
                    />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-y-1.5 gap-x-3 text-[12px]">
                  {stageRows.map((s) => (
                    <div key={s.stage} className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: STAGE_META[s.stage]?.color ?? "var(--muted)" }}
                      />
                      <span className="flex-1 text-foreground/80">
                        {STAGE_META[s.stage]?.label ?? s.stage}
                      </span>
                      <span className="tabular font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {needsReply > 0 && (
              <div className="mt-2 flex gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-draft-tint text-[12px] text-draft-ink">
                <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" strokeWidth={1.8} />
                <div>
                  <strong>{needsReply} thread{needsReply !== 1 ? "s" : ""} need{needsReply === 1 ? "s" : ""} a reply.</strong>{" "}
                  <Link href="/inbox" className="underline">Open inbox →</Link>
                </div>
              </div>
            )}
          </Card>

          {/* Saathi activity */}
          <Card className="p-5 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <div className="font-heading text-[14px] font-semibold">Saathi activity</div>
              </div>
              <Badge variant="outline" className="text-[10px]">last 24h</Badge>
            </div>
            {recentCalls.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No AI activity yet.</p>
            ) : (
              <div className="space-y-2.5">
                {recentCalls.slice(0, 5).map((c) => {
                  const time = new Date(c.createdAt).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit", hour12: false,
                  });
                  const isDraft = c.task === "draft";
                  const isError = c.status === "error" || c.status === "cap_blocked";
                  const tone = isError
                    ? "bg-neg-tint text-neg"
                    : isDraft
                      ? "bg-draft-tint text-draft-ink"
                      : "bg-muted text-muted-foreground";
                  const text = isDraft
                    ? `Drafted reply · ${c.provider}/${c.model}${c.latencyMs ? ` · ${(c.latencyMs / 1000).toFixed(1)}s` : ""}`
                    : `Classified email · ${c.provider}/${c.model}`;
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 text-[12.5px]">
                      <span className="font-mono text-muted-foreground tabular w-[38px]">{time}</span>
                      <span className={`inline-flex items-center h-[18px] px-1.5 rounded text-[10px] font-semibold capitalize whitespace-nowrap ${tone}`}>
                        {c.task}
                      </span>
                      <span className="text-foreground/85 line-clamp-1">{text}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2 pt-3 border-t border-border flex justify-between text-[12px] text-muted-foreground">
              <span>
                Spent{" "}
                <strong className="tabular text-foreground">
                  {cap.unlimited ? "–" : `₹${cap.spentInr.toFixed(2)}`}
                </strong>{" "}
                {cap.unlimited ? "(no cap)" : `of ₹${cap.capInr.toFixed(0)} daily cap`}
              </span>
              <span>{recentCalls.length} call{recentCalls.length !== 1 ? "s" : ""}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function InboxPulseChart({
  trend,
}: {
  trend: Array<{ date: string; relevant: number; cold: number; other: number }>;
}) {
  const totals = trend.map((d) => d.relevant + d.cold + d.other);
  const max = Math.max(...totals, 1);
  return (
    <div className="flex items-end gap-1.5 h-[110px]">
      {trend.map((d, i) => {
        const v = d.relevant + d.cold + d.other;
        const isToday = i === trend.length - 1;
        const dayNum = new Date(d.date).getDate();
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative">
            <div className="w-full flex items-end h-[90px] relative">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(v / max) * 100}%`,
                  background: isToday
                    ? "linear-gradient(180deg, var(--primary), oklch(0.40 0.10 162))"
                    : "linear-gradient(180deg, var(--surface-3), oklch(0.86 0.014 80))",
                }}
              >
                {isToday && v > 0 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-draft-ink whitespace-nowrap">
                    {v} today
                  </div>
                )}
              </div>
            </div>
            <div className={`text-[10px] ${isToday ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
              {dayNum}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ color, label, v }: { color: string; label: string; v: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
      <span className="tabular text-foreground font-semibold">{v}</span>
    </div>
  );
}

function Stat({ label, v, delta }: { label: string; v: string; delta: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="tabular text-[18px] font-semibold -tracking-[0.01em]">{v}</span>
        {delta && <span className="text-[10.5px] font-semibold text-pos">{delta}</span>}
      </div>
    </div>
  );
}
