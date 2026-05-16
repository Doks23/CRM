"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Mail,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data shape — matches /api/reports response
// ────────────────────────────────────────────────────────────────────────────

interface ReportData {
  emails: { total: number; inbound: number; outbound: number };
  categoryBreakdown: { category: string | null; count: number }[];
  leads: { total: number; byStage: Record<string, number> };
  drafts: {
    total: number;
    pending: number;
    approved: number;
    edited: number;
    sent: number;
    discarded: number;
  };
  ai: {
    window: string;
    calls: number;
    ok: number;
    errors: number;
    capBlocked: number;
    classifyCalls: number;
    draftCalls: number;
    inputTokens: number;
    outputTokens: number;
    costInr24h: number;
    avgLatencyMs: number;
    cap: {
      unlimited: boolean;
      capInr: number;
      spentInr: number;
      remainingInr: number | null;
      startOfDay: string;
    };
    recentErrors: Array<{
      id: string;
      task: string;
      provider: string;
      model: string;
      status: string;
      errorMessage: string | null;
      createdAt: string;
    }>;
  };
}

type Tab = "overview" | "inbox" | "conversion" | "cost";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "inbox", label: "Inbox health" },
  { id: "conversion", label: "Conversion" },
  { id: "cost", label: "AI cost" },
];

// ────────────────────────────────────────────────────────────────────────────
// Top-level component
// ────────────────────────────────────────────────────────────────────────────

export function ReportsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "inbox" || tabParam === "conversion" || tabParam === "cost"
      ? tabParam
      : "overview";

  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load"));
  }, []);

  function setTab(t: Tab) {
    const params = new URLSearchParams(searchParams);
    if (t === "overview") params.delete("tab");
    else params.set("tab", t);
    const qs = params.toString();
    router.replace(`/reports${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-0.5 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-3 h-9 text-[13px] font-medium transition-colors",
              tab === t.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-meta">Loading…</p>
      ) : tab === "overview" ? (
        <OverviewTab data={data} />
      ) : tab === "inbox" ? (
        <InboxTab data={data} />
      ) : tab === "conversion" ? (
        <ConversionTab data={data} />
      ) : (
        <CostTab data={data} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Overview tab — KPI row + cost summary
// ────────────────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ReportData }) {
  const draftEditedRate =
    data.drafts.total > 0
      ? Math.round((data.drafts.edited / data.drafts.total) * 100)
      : 0;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Emails"
          value={data.emails.total}
          hint={`${data.emails.inbound} in · ${data.emails.outbound} out`}
        />
        <KpiCard
          icon={<Users className="h-3.5 w-3.5" />}
          label="Leads"
          value={data.leads.total}
          hint={`${Object.keys(data.leads.byStage).length} stages`}
        />
        <KpiCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Drafts sent"
          value={data.drafts.sent}
          hint={`${data.drafts.pending} pending · ${draftEditedRate}% edited`}
        />
      </div>
      <CostSummaryCard data={data} compact />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inbox tab — AI category breakdown + draft outcomes
// ────────────────────────────────────────────────────────────────────────────

function InboxTab({ data }: { data: ReportData }) {
  const draftOutcomes = useMemo(
    () => [
      { label: "Sent as-is", count: data.drafts.approved, tone: "primary" },
      { label: "Edited", count: data.drafts.edited, tone: "info" },
      { label: "Pending", count: data.drafts.pending, tone: "muted" },
      { label: "Discarded", count: data.drafts.discarded, tone: "destructive" },
    ],
    [data.drafts],
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panel title="AI categories" subtitle="How the classifier tagged inbound emails">
        {data.categoryBreakdown.length === 0 ? (
          <EmptyHint text="No classified emails yet" />
        ) : (
          <BarList
            rows={data.categoryBreakdown.map((c) => ({
              label: c.category ?? "unclassified",
              count: c.count,
            }))}
          />
        )}
      </Panel>

      <Panel title="Draft outcomes" subtitle="How the team treats AI drafts">
        <BarList
          rows={draftOutcomes.map((o) => ({ label: o.label, count: o.count }))}
        />
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Conversion tab — pipeline stage funnel
// ────────────────────────────────────────────────────────────────────────────

function ConversionTab({ data }: { data: ReportData }) {
  const STAGE_ORDER = [
    "new",
    "needs_review",
    "qualified",
    "info_sent",
    "negotiation",
    "po_received",
    "dispatched",
    "won",
    "lost",
    "nurture",
  ];
  const rows = STAGE_ORDER.map((s) => ({
    label: s.replace(/_/g, " "),
    count: data.leads.byStage[s] ?? 0,
    raw: s,
  })).filter((r) => r.count > 0);

  const won = data.leads.byStage.won ?? 0;
  const lost = data.leads.byStage.lost ?? 0;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard label="Active leads" value={data.leads.total - won - lost} />
        <KpiCard label="Won" value={won} />
        <KpiCard
          label="Win rate"
          value={winRate === null ? "—" : `${winRate}%`}
          hint={`${won} won · ${lost} lost`}
        />
      </div>
      <Panel title="Pipeline by stage">
        {rows.length === 0 ? (
          <EmptyHint text="No leads yet" />
        ) : (
          <BarList rows={rows} />
        )}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cost tab — daily cap, breakdown, errors
// ────────────────────────────────────────────────────────────────────────────

function CostTab({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <CostSummaryCard data={data} />
      {data.ai.recentErrors.length > 0 ? (
        <Panel
          title="Recent errors & cap-blocks"
          subtitle="Last 10 in the past 24 hours"
        >
          <ul className="divide-y divide-border/60">
            {data.ai.recentErrors.map((e) => (
              <li
                key={e.id}
                className="py-2 first:pt-0 last:pb-0 flex items-start gap-3 text-[12px]"
              >
                <span
                  className={cn(
                    "shrink-0 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                    e.status === "cap_blocked"
                      ? "border-warning/30 text-warning-foreground bg-warning/10"
                      : "border-destructive/30 text-destructive bg-destructive/10",
                  )}
                >
                  {e.status === "cap_blocked" ? "blocked" : "error"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">
                    {e.task} · {e.provider}/{e.model}
                  </div>
                  <div className="text-foreground/85 truncate">
                    {e.errorMessage ?? "(no message)"}
                  </div>
                </div>
                <div className="text-meta tabular-nums shrink-0">
                  {formatTime(e.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function CostSummaryCard({
  data,
  compact,
}: {
  data: ReportData;
  compact?: boolean;
}) {
  const { ai } = data;
  const { cap } = ai;
  const pct = cap.unlimited
    ? 0
    : Math.min(
        100,
        Math.round((cap.spentInr / Math.max(cap.capInr, 0.01)) * 100),
      );
  const capReached = !cap.unlimited && cap.spentInr >= cap.capInr;
  const nearCap = !cap.unlimited && pct >= 80 && !capReached;

  return (
    <Panel
      title="AI activity · last 24 hours"
      subtitle={
        cap.unlimited
          ? "No daily cap configured"
          : capReached
            ? "Cap reached — drafts paused"
            : nearCap
              ? `${pct}% of today's cap`
              : `${pct}% of today's cap`
      }
      right={
        <span
          className={cn(
            "text-[11px] tabular-nums font-medium",
            capReached
              ? "text-destructive"
              : nearCap
                ? "text-warning-foreground"
                : "text-muted-foreground",
          )}
        >
          ₹{ai.costInr24h.toFixed(2)}
        </span>
      }
    >
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        <Stat
          label="Calls"
          value={String(ai.calls)}
          hint={`${ai.classifyCalls} classify · ${ai.draftCalls} draft`}
        />
        <Stat
          label="Cost (24h)"
          value={`₹${ai.costInr24h.toFixed(2)}`}
          hint={
            cap.unlimited
              ? "no cap"
              : `₹${cap.spentInr.toFixed(2)} today / ₹${cap.capInr.toFixed(2)}`
          }
        />
        <Stat
          label="Tokens"
          value={formatTokens(ai.inputTokens + ai.outputTokens)}
          hint={`${formatTokens(ai.inputTokens)} in · ${formatTokens(ai.outputTokens)} out`}
        />
        <Stat
          label="Avg latency"
          value={`${(ai.avgLatencyMs / 1000).toFixed(1)}s`}
          hint={`${ai.ok} ok · ${ai.errors} err${ai.capBlocked ? ` · ${ai.capBlocked} blk` : ""}`}
        />
      </div>
      {!cap.unlimited ? (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                capReached
                  ? "bg-destructive"
                  : nearCap
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="px-4 py-3 border-b border-border/60 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold">{title}</h3>
          {subtitle ? <p className="text-meta mt-0.5">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-eyebrow">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-[22px] font-semibold tabular-nums leading-none mt-1.5">
        {value}
      </div>
      {hint ? <div className="text-meta mt-1.5">{hint}</div> : null}
    </div>
  );
}

function BarList({
  rows,
}: {
  rows: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-[12px]">
          <span className="capitalize w-28 shrink-0 text-foreground/80">
            {r.label}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground tabular-nums w-10 text-right">
            {r.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="text-eyebrow">{label}</div>
      <div className="text-[16px] font-semibold tabular-nums leading-none mt-1">
        {value}
      </div>
      {hint ? <div className="text-meta mt-1 truncate">{hint}</div> : null}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-meta py-4 text-center">{text}</p>;
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Unused but kept available for future arrow-tagged tabs
void ArrowUpRight;
void TrendingUp;
void AlertCircle;
