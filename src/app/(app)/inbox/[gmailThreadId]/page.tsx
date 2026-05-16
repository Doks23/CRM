import { notFound } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { db } from "@/db";
import {
  emailMessages,
  leads,
  aiDrafts,
  products,
  sampleDispatches,
  customers,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DraftPanel } from "@/components/inbox/draft-panel";
import { ClassifyButton } from "@/components/inbox/classify-button";
import { LeadMemoryPanel } from "@/components/inbox/lead-memory-panel";
import { SampleTracker } from "@/components/inbox/sample-tracker";
import { StageSelect } from "@/components/inbox/stage-select";
import { CustomerLinkButton } from "@/components/inbox/customer-link-button";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ gmailThreadId: string }>;
}) {
  const { gmailThreadId } = await params;
  const messages = await db.query.emailMessages.findMany({
    where: eq(emailMessages.gmailThreadId, gmailThreadId),
    orderBy: asc(emailMessages.receivedAt),
  });

  if (messages.length === 0) notFound();

  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, messages[0].leadId),
  });

  const [profile, , samples, linkedCustomer] = await Promise.all([
    db.query.businessProfile.findFirst(),
    db.query.products.findMany({ where: eq(products.active, true) }),
    lead
      ? db.query.sampleDispatches.findMany({
          where: eq(sampleDispatches.leadId, lead.id),
          orderBy: [desc(sampleDispatches.createdAt)],
          limit: 20,
        })
      : Promise.resolve([]),
    lead?.customerId
      ? db.query.customers.findFirst({ where: eq(customers.id, lead.customerId) })
      : Promise.resolve(null),
  ]);

  const latestInbound = [...messages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const draft = latestInbound
    ? await db.query.aiDrafts.findFirst({
        where: eq(aiDrafts.inReplyToMessageId, latestInbound.id),
      })
    : null;

  const subject = messages.find((m) => m.subject)?.subject ?? "(no subject)";

  return (
    <div className="flex flex-col h-full">
      {/* Minimal header bar */}
      {lead && (
        <div className="px-6 pt-3 pb-0 flex items-center gap-2 text-[13px] text-muted-foreground flex-wrap">
          {lead.source === "linkedin" && (
            <span className="h-[18px] px-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] bg-[#0A66C2]/10 text-[#0A66C2] flex items-center">in</span>
          )}
          <span className="text-foreground/85 font-medium">{lead.contactName || lead.primaryEmail}</span>
          {lead.company && <><span className="text-foreground/30">·</span><span>{lead.company}</span></>}
          <span className="text-foreground/30">·</span>
          <span className="font-mono text-[11px]">{lead.leadCode}</span>
          <span className="text-foreground/30">·</span>
          <CustomerLinkButton
            leadId={lead.id}
            leadContact={{ contactName: lead.contactName, primaryEmail: lead.primaryEmail, company: lead.company, phone: lead.phone }}
            customer={linkedCustomer ? { id: linkedCustomer.id, customerCode: linkedCustomer.customerCode, name: linkedCustomer.name } : null}
          />
        </div>
      )}
      {/* Body: 2-column on lg+, stacked on mobile (rail above thread) */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] max-w-[1400px] mx-auto">
          {/* ── Right rail comes second in DOM order for desktop layout,
              but on mobile the parent grid-col-1 lays it after the thread.
              Reverse via flex-col-reverse-on-mobile pattern below. */}
          <div className="space-y-4 min-w-0 order-2 lg:order-1">
            <SubjectLine subject={subject} messageCount={messages.length} />
            <Thread messages={messages} lead={lead} />

            {/* Reply surface */}
            {latestInbound && !latestInbound.aiCategory ? (
              <div className="rounded-lg border bg-card">
                <ClassifyButton
                  gmailMessageId={latestInbound.gmailMessageId}
                  subject={subject}
                  toEmail={latestInbound.fromEmail ?? lead?.primaryEmail ?? ""}
                />
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <DraftPanel
                  draft={
                    draft
                      ? {
                          id: draft.id,
                          body: draft.draftBody,
                          editedBody: draft.editedBody,
                          status: draft.status as string,
                          gmailDraftId: draft.gmailDraftId,
                          inReplyToMessageId:
                            draft.inReplyToMessageId ?? undefined,
                        }
                      : null
                  }
                  subject={subject}
                  toEmail={latestInbound?.fromEmail ?? lead?.primaryEmail ?? ""}
                  threadId={gmailThreadId}
                  leadId={messages[0].leadId}
                  aiCategory={latestInbound?.aiCategory ?? null}
                  inboundProcessedAt={
                    latestInbound?.processedAt
                      ? new Date(latestInbound.processedAt).toISOString()
                      : null
                  }
                  inboundMessageId={latestInbound?.id ?? null}
                  businessProfile={
                    profile
                      ? {
                          companyName: profile.companyName ?? "White Pops",
                          drafterProvider: profile.drafterProvider,
                          drafterModel: profile.drafterModel,
                        }
                      : null
                  }
                />
              </div>
            )}
          </div>

          {/* Right rail: AI memory, samples, details. Stacks above on mobile. */}
          <div className="space-y-4 min-w-0 order-1 lg:order-2 lg:w-[320px]">
            {lead ? (
              <LeadMemoryPanel
                leadId={lead.id}
                initialNotes={lead.notesForAi ?? null}
              />
            ) : null}
            {lead ? (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Lead</div>
                <div className="flex flex-wrap items-center gap-2">
                  <StageSelect leadId={lead.id} currentStage={lead.stage} />
                  <CustomerLinkButton
                    leadId={lead.id}
                    leadContact={{ contactName: lead.contactName, primaryEmail: lead.primaryEmail, company: lead.company, phone: lead.phone }}
                    customer={linkedCustomer ? { id: linkedCustomer.id, customerCode: linkedCustomer.customerCode, name: linkedCustomer.name } : null}
                  />
                </div>
              </div>
            ) : null}
            {lead ? (
              <SampleTracker
                leadId={lead.id}
                initial={samples.map((s) => ({
                  id: s.id,
                  status: s.status,
                  sku: s.sku,
                  quantityNote: s.quantityNote,
                  courier: s.courier,
                  awb: s.awb,
                  sentAt: s.sentAt ? new Date(s.sentAt).toISOString() : null,
                  deliveredAt: s.deliveredAt
                    ? new Date(s.deliveredAt).toISOString()
                    : null,
                  followUpDueAt: s.followUpDueAt
                    ? new Date(s.followUpDueAt).toISOString()
                    : null,
                  note: s.note,
                  createdAt: new Date(s.createdAt).toISOString(),
                }))}
              />
            ) : null}
            {lead ? (
              <DetailsCard
                createdAt={lead.createdAt}
                firstContactAt={lead.firstContactAt}
                lastActivityAt={lead.lastActivityAt}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subject + count line just above the thread (separates thread from header)
// ────────────────────────────────────────────────────────────────────────────

function SubjectLine({
  subject,
  messageCount,
}: {
  subject: string;
  messageCount: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="truncate">{subject}</h2>
      <span className="text-meta tabular-nums shrink-0">
        {messageCount} message{messageCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Thread — Front-style flat cards, no chat bubbles
// ────────────────────────────────────────────────────────────────────────────

interface ThreadMessageProps {
  messages: typeof emailMessages.$inferSelect extends infer T ? T[] : never;
  lead: typeof leads.$inferSelect | null | undefined;
}

function Thread({
  messages,
  lead,
}: {
  messages: typeof emailMessages.$inferSelect[];
  lead: typeof leads.$inferSelect | null | undefined;
}) {
  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const inbound = msg.direction === "inbound";
        const author = inbound
          ? lead?.contactName ?? msg.fromEmail ?? "Unknown"
          : "You";
        return (
          <article
            key={msg.id}
            className="rounded-lg border bg-card overflow-hidden"
          >
            <header
              className={cn(
                "px-4 py-2 flex items-center gap-2 text-[13px] border-b border-border/60",
                inbound ? "bg-muted/30" : "bg-primary/[0.04]",
              )}
            >
              {inbound ? (
                <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="font-semibold text-foreground truncate">
                {author}
              </span>
              <span className="text-muted-foreground truncate">
                {inbound && msg.fromEmail && msg.fromEmail !== author
                  ? `<${msg.fromEmail}>`
                  : ""}
              </span>
              <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                {formatDateTime(msg.receivedAt)}
              </span>
              {msg.aiCategory && msg.aiCategory !== "relevant" ? (
                <Badge
                  variant="outline"
                  className="text-[11px] py-0 h-4 capitalize ml-1 border-foreground/15 text-muted-foreground"
                >
                  {msg.aiCategory}
                </Badge>
              ) : null}
            </header>
            <div className="px-4 py-3 text-[14px] leading-[1.55] whitespace-pre-wrap break-words text-foreground/90">
              {msg.bodyText || (
                <span className="italic text-muted-foreground">
                  (no content)
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Right-rail Details card — Lightning "Details" pattern
// ────────────────────────────────────────────────────────────────────────────

function DetailsCard({
  createdAt,
  firstContactAt,
  lastActivityAt,
}: {
  createdAt: Date | null;
  firstContactAt: Date | null;
  lastActivityAt: Date | null;
}) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "First contact",
      value: firstContactAt
        ? formatDate(firstContactAt)
        : createdAt
          ? formatDate(createdAt)
          : "—",
    },
    {
      label: "Last activity",
      value: lastActivityAt ? formatRelative(lastActivityAt) : "—",
    },
    {
      label: "Created",
      value: createdAt ? formatDate(createdAt) : "—",
    },
  ];
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-3 py-2 border-b border-border/60">
        <div className="text-eyebrow">Details</div>
      </div>
      <dl className="divide-y divide-border/60">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-3 py-2 text-[13px]"
          >
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-foreground tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Date formatters
// ────────────────────────────────────────────────────────────────────────────

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
