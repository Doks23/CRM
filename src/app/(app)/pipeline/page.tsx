import { desc, eq, sql } from "drizzle-orm";
import {
  Filter,
  ArrowUpDown,
  Users,
  Grid3x3,
  List,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/auth";
import { db } from "@/db";
import { leads, emailMessages, users } from "@/db/schema";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { CreateLeadButton } from "@/components/pipeline/create-lead-button";

export const dynamic = "force-dynamic";

// Summary bar uses illustrative colours only — real counts come from the board.
const STAGE_COLORS = [
  { id: "new",         label: "New",         color: "var(--stage-1)" },
  { id: "info_sent",   label: "Info Sent",   color: "var(--stage-4)" },
  { id: "negotiation", label: "Negotiation", color: "var(--stage-5)" },
  { id: "po",          label: "PO",          color: "var(--stage-6)" },
  { id: "dispatched",  label: "Dispatched",  color: "var(--stage-2)" },
];

export default async function PipelinePage() {
  const [session, leadsWithStats, allUsers] = await Promise.all([
    auth(),
    db
      .select({
        id: leads.id,
        leadCode: leads.leadCode,
        contactName: leads.contactName,
        primaryEmail: leads.primaryEmail,
        company: leads.company,
        leadType: leads.leadType,
        stage: leads.stage,
        score: leads.score,
        lastActivityAt: leads.lastActivityAt,
        assignedUserId: leads.assignedUserId,
        messageCount: sql<number>`count(${emailMessages.id})`.mapWith(Number),
        latestThreadId: sql<string | null>`(
          select gmail_thread_id from "email_message"
          where lead_id = ${leads.id}
          order by received_at desc
          limit 1
        )`,
      })
      .from(leads)
      .leftJoin(emailMessages, eq(emailMessages.leadId, leads.id))
      .groupBy(leads.id)
      .orderBy(desc(leads.lastActivityAt)),
    db.query.users.findMany({
      where: eq(users.active, true),
      columns: { id: true, name: true, email: true, role: true },
    }),
  ]);

  // Group leads by stage key for the KanbanBoard.
  const HIDDEN_STAGES = new Set(["ignored"]);
  const VISIBLE_STAGES = new Set(["new", "info_sent", "negotiation", "po", "dispatched"]);
  const leadsByStage: Record<string, typeof leadsWithStats> = {};
  for (const lead of leadsWithStats) {
    if (HIDDEN_STAGES.has(lead.stage)) continue;
    if (!VISIBLE_STAGES.has(lead.stage)) continue;
    const bucket = leadsByStage[lead.stage] ?? [];
    bucket.push(lead);
    leadsByStage[lead.stage] = bucket;
  }

  const sessionUserId = session?.user?.id ?? null;
  const totalLeads = leadsWithStats.length;

  // Count distribution for the summary bar.
  const stageCounts = STAGE_COLORS.map((s) => ({
    ...s,
    count: leadsByStage[s.id]?.length ?? 0,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] min-h-0 p-5 lg:p-6 gap-3.5">
      <PipelineHead totalLeads={totalLeads} />
      <PipelineSummary stageCounts={stageCounts} />
      <div className="flex-1 min-h-0">
        <KanbanBoard leadsByStage={leadsByStage} users={allUsers} sessionUserId={sessionUserId} />
      </div>
    </div>
  );
}

function PipelineHead({ totalLeads }: { totalLeads: number }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-baseline gap-3.5 flex-wrap">
        <h1 className="serif text-[30px] leading-tight -tracking-[0.015em]">
          Pipeline
        </h1>
        <span className="text-[14px] text-muted-foreground">
          {totalLeads} lead{totalLeads !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center bg-card border border-border rounded-lg p-0.5">
          <ViewToggle Icon={Grid3x3} active />
          <ViewToggle Icon={List} />
        </div>
        <Button variant="outline" size="sm">
          <Users className="size-3.5" /> Mine
        </Button>
        <Button variant="outline" size="sm">
          <Filter className="size-3.5" /> Filter
        </Button>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="size-3.5" /> Sort
        </Button>
        <CreateLeadButton />
      </div>
    </div>
  );
}

function ViewToggle({
  Icon,
  active,
}: {
  Icon: typeof Grid3x3;
  active?: boolean;
}) {
  return (
    <button
      className={`h-7 w-8 grid place-items-center rounded-md ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/5"
      }`}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
    </button>
  );
}

function PipelineSummary({
  stageCounts,
}: {
  stageCounts: Array<{ id: string; label: string; color: string; count: number }>;
}) {
  const total = stageCounts.reduce((s, x) => s + x.count, 0) || 1;
  const active = stageCounts.filter((s) => s.count > 0);
  return (
    <Card className="p-3.5 px-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1.5">
            Stage distribution
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden">
            {active.length === 0 ? (
              <div className="h-full w-full bg-muted rounded-full" />
            ) : (
              active.map((s) => (
                <div
                  key={s.id}
                  style={{ flex: s.count, background: s.color }}
                  title={`${s.label}: ${s.count}`}
                />
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {active.map((s) => (
              <div key={s.id} className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold text-foreground/85">{s.label}</span>
                <span>{s.count}</span>
              </div>
            ))}
            {active.length === 0 && (
              <span className="text-[12px] text-muted-foreground">No leads yet</span>
            )}
          </div>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex gap-5 flex-wrap">
          <PipeStat label="Total leads" v={String(total)} />
          <PipeStat label="Stages active" v={String(active.length)} />
        </div>
      </div>
    </Card>
  );
}

function PipeStat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="serif tabular text-[22px] -tracking-[0.01em] mt-0.5">{v}</div>
    </div>
  );
}
