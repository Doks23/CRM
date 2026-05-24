import { desc, eq, isNull, sql, inArray } from "drizzle-orm";

import { Card } from "@/components/ui/card";
import { auth } from "@/auth";
import { db } from "@/db";
import { leads, emailMessages, users, customers } from "@/db/schema";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { PipelineToolbar } from "@/components/pipeline/pipeline-toolbar";
import { PIPELINE_STAGES } from "@/lib/pipeline-stages";

export const dynamic = "force-dynamic";

const STAGE_COLORS = PIPELINE_STAGES;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { mine } = await searchParams;
  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;

  const [leadsWithStats, allUsers] = await Promise.all([
    db
      .select({
        id: leads.id,
        leadCode: leads.leadCode,
        contactName: leads.contactName,
        primaryEmail: leads.primaryEmail,
        company: leads.company,
        phone: leads.phone,
        notesForAi: leads.notesForAi,
        leadType: leads.leadType,
        stage: leads.stage,
        score: leads.score,
        lastActivityAt: leads.lastActivityAt,
        assignedUserId: leads.assignedUserId,
        customerId: leads.customerId,
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
      .where(
        mine === "true" && sessionUserId
          ? sql`${leads.deletedAt} is null and ${leads.assignedUserId} = ${sessionUserId}`
          : isNull(leads.deletedAt)
      )
      .groupBy(leads.id)
      .orderBy(desc(leads.lastActivityAt)),
    db.query.users.findMany({
      where: eq(users.active, true),
      columns: { id: true, name: true, email: true, role: true },
    }),
  ]);

  let leadsWithCustomers = leadsWithStats.map((l) => ({ ...l, linkedCustomer: null as any }));

  const customerIds = leadsWithStats
    .map((l) => l.customerId)
    .filter((id): id is string => id !== null);

  if (customerIds.length > 0) {
    const customerList = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        email: customers.email,
        company: customers.company,
      })
      .from(customers)
      .where(inArray(customers.id, customerIds));

    const customerMap = new Map(customerList.map((c) => [c.id, c]));
    leadsWithCustomers = leadsWithStats.map((l) => ({
      ...l,
      linkedCustomer: l.customerId ? customerMap.get(l.customerId) ?? null : null,
    }));
  }

  const HIDDEN_STAGES = new Set(["ignored"]);
  const VISIBLE_STAGES = new Set(["new", "info_sent", "negotiation", "po", "dispatched"]);
  const leadsByStage: Record<string, typeof leadsWithCustomers> = {};
  for (const lead of leadsWithCustomers) {
    if (HIDDEN_STAGES.has(lead.stage)) continue;
    if (!VISIBLE_STAGES.has(lead.stage)) continue;
    const bucket = leadsByStage[lead.stage] ?? [];
    bucket.push(lead);
    leadsByStage[lead.stage] = bucket;
  }

  const totalLeads = Object.values(leadsByStage).flat().length;

  const stageCounts = STAGE_COLORS.map((s) => ({
    ...s,
    count: leadsByStage[s.id]?.length ?? 0,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] min-h-0 p-5 lg:p-6 gap-3.5">
      <PipelineHead totalLeads={totalLeads} mine={mine === "true"} />
      <PipelineSummary stageCounts={stageCounts} />
      <div className="flex-1 min-h-0">
        <KanbanBoard leadsByStage={leadsByStage} users={allUsers} sessionUserId={sessionUserId} />
      </div>
    </div>
  );
}

function PipelineHead({ totalLeads, mine }: { totalLeads: number; mine: boolean }) {
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
      <PipelineToolbar mine={mine} />
    </div>
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
