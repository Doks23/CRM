import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import {
  Mail,
  Sparkles,
  Clock,
  Inbox as InboxIcon,
  Layers,
  MoreHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";

import { db } from "@/db";
import { aiDrafts, emailMessages, gmailAccount, leads, customers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SmartAvatar } from "@/components/app/smart-avatar";
import { StagePill, StageDot } from "@/components/app/stage-pill";
import { StageSelect } from "@/components/inbox/stage-select";
import { CustomerLinkButton } from "@/components/inbox/customer-link-button";
import { DraftPanel } from "@/components/inbox/draft-panel";
import { InboxSearch } from "@/components/inbox/inbox-search";
import {
  listInboxThreads,
  countInboxTabs,
  type InboxFilter,
} from "@/lib/queries/inbox";
export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; filter?: string; q?: string }>;
}) {
  const { t: selectedThreadId, filter = "new", q } = await searchParams;

  const [threads, counts, account] = await Promise.all([
    listInboxThreads({ filter: filter as InboxFilter, query: q ?? null, limit: 50 }),
    countInboxTabs(q ?? null),
    db.query.gmailAccount.findFirst({
      columns: { email: true, lastPolledAt: true },
    }),
  ]);

  // Stage counts for the "By stage" folder section
  const stageCountRows = await db
    .select({
      stage: leads.stage,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(leads)
    .groupBy(leads.stage)
    .orderBy(leads.stage);

  // Load selected thread content
  let selectedContent: {
    messages: (typeof emailMessages.$inferSelect)[];
    lead: (typeof leads.$inferSelect & { leadCode: string }) | null;
    draft: typeof aiDrafts.$inferSelect | null;
    latestInbound: typeof emailMessages.$inferSelect | null;
    profile: { companyName: string; drafterProvider: string | null; drafterModel: string | null } | null;
    linkedCustomer: { id: string; customerCode: string; name: string } | null;
  } | null = null;

  if (selectedThreadId) {
    const [msgs, profile] = await Promise.all([
      db.query.emailMessages.findMany({
        where: eq(emailMessages.gmailThreadId, selectedThreadId),
        orderBy: asc(emailMessages.receivedAt),
      }),
      db.query.businessProfile.findFirst(),
    ]);

    const firstMsg = msgs[0];
    const lead = firstMsg
      ? await db.query.leads.findFirst({ where: eq(leads.id, firstMsg.leadId) })
      : null;

    const latestInbound = [...msgs].reverse().find((m) => m.direction === "inbound") ?? null;
    const draft = latestInbound
      ? await db.query.aiDrafts.findFirst({
          where: eq(aiDrafts.inReplyToMessageId, latestInbound.id),
        })
      : null;

    let linkedCustomer: { id: string; customerCode: string; name: string } | null = null;
    if (lead?.customerId) {
      const c = await db.query.customers.findFirst({
        where: eq(customers.id, lead.customerId),
        columns: { id: true, customerCode: true, name: true },
      });
      if (c) linkedCustomer = c;
    }

    selectedContent = {
      messages: msgs,
      lead: lead ?? null,
      draft: draft ?? null,
      latestInbound,
      profile: profile
        ? {
            companyName: profile.companyName ?? "",
            drafterProvider: profile.drafterProvider,
            drafterModel: profile.drafterModel,
          }
        : null,
      linkedCustomer,
    };
  }

  const syncedAgo = account?.lastPolledAt
    ? formatRelative(account.lastPolledAt)
    : "never";

  const STAGE_LABELS: Record<string, string> = {
    new: "New", ignored: "Ignored",
    info_sent: "Info Sent", negotiation: "Negotiation",
    po: "PO", dispatched: "Dispatched",
  };

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-0">
      {/* ── Folders rail ──────────────────────────────────────────────── */}
      <div className="w-[220px] shrink-0 border-r border-border bg-background overflow-y-auto px-3.5 py-4 space-y-5">
        <div>
          <div className="serif text-[26px] leading-tight">Inbox</div>
          <div className="text-[12.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="relative inline-flex size-1.5 rounded-full bg-pos">
              <span className="absolute inset-0 rounded-full bg-pos animate-ping opacity-60" />
            </span>
            {account?.email ?? "not connected"} · {syncedAgo}
          </div>
        </div>

        <FolderGroup label="Triage">
          <FolderItem
            Icon={Mail} label="New Mail" count={counts.new}
            hot active={filter === "new"}
            href={q ? `/inbox?filter=new&q=${q}` : "/inbox?filter=new"}
          />
          <FolderItem
            Icon={Sparkles} label="Draft Ready" count={counts.draft}
            draft active={filter === "draft"}
            href={q ? `/inbox?filter=draft&q=${q}` : "/inbox?filter=draft"}
          />
          <FolderItem
            Icon={Clock} label="All Threads" count={counts.all}
            active={filter === "all"}
            href={q ? `/inbox?filter=all&q=${q}` : "/inbox?filter=all"}
          />
          <FolderItem
            Icon={InboxIcon} label="Awaiting" count={counts.awaiting}
            active={filter === "awaiting"}
            href={q ? `/inbox?filter=awaiting&q=${q}` : "/inbox?filter=awaiting"}
          />
        </FolderGroup>

        <FolderGroup label="By stage">
          {stageCountRows.map((s) => {
            const key = s.stage === "po_received" ? "po" : s.stage;
            if (s.stage === "ignored") return null;
            if (!STAGE_LABELS[key]) return null;
            return (
              <Link
                key={s.stage}
                href={`/inbox?filter=all&stage=${s.stage}`}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[14px] text-muted-foreground hover:bg-foreground/5"
              >
                <StageDot stage={key} />
                <span className="flex-1">{STAGE_LABELS[key]}</span>
                <span className="tabular text-[12px] font-semibold">{s.count}</span>
              </Link>
            );
          })}
        </FolderGroup>
      </div>

      {/* ── Thread list ───────────────────────────────────────────────── */}
      <div className="w-[360px] shrink-0 border-r border-border bg-card flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-muted-foreground shrink-0">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}
          </span>
          <InboxSearch initialQuery={q ?? ""} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <InboxIcon className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">No threads</p>
              <p className="text-[12.5px] text-muted-foreground/70 mt-1">
                {filter === "new"
                  ? "No new mail"
                  : filter === "draft"
                    ? "No pending drafts"
                    : "No emails synced yet"}
              </p>
            </div>
          ) : (
            threads.map((t) => {
              const isSelected = t.gmailThreadId === selectedThreadId;
              const hasDraft = t.latestDraftStatus === "pending";
              const ageMs = t.lastMessageAt
                ? Date.now() - new Date(t.lastMessageAt).getTime()
                : 0;
              const ageH = Math.floor(ageMs / 3_600_000);
              const ageLabel = ageH < 1 ? "now" : ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
              const isUnread = t.latestDirection === "inbound";
              return (
                <Link
                  key={t.gmailThreadId}
                  href={`/inbox?filter=${filter}&t=${t.gmailThreadId}`}
                  className={`relative block px-4 py-3 border-b border-border ${isSelected ? "bg-draft-tint" : "hover:bg-foreground/[0.03]"}`}
                  style={{
                    borderLeft: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                    paddingLeft: "14px",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SmartAvatar name={t.contactName ?? t.primaryEmail} size="sm" />
                    <span className={`flex-1 truncate text-[14px] ${isUnread ? "font-semibold" : "font-medium"}`}>
                      {t.contactName ?? t.primaryEmail}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">{t.leadCode}</span>
                    <span className="text-[11.5px] text-muted-foreground">{ageLabel}</span>
                  </div>
                  {t.company && (
                    <div className="text-[12.5px] text-muted-foreground mb-1">{t.company}</div>
                  )}
                  <div className={`text-[13.5px] mb-1 truncate ${isUnread ? "font-semibold" : "font-medium text-foreground/85"}`}>
                    {t.subject ?? "(no subject)"}
                  </div>
                  <p className="text-[12.5px] text-muted-foreground leading-[1.4] line-clamp-2">
                    {t.latestSnippet ?? ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {t.stage && <StagePill label={STAGE_LABELS[t.stage === "po_received" ? "po" : t.stage] ?? t.stage} className="text-[11.5px]" dotSize={6} />}
                    {hasDraft && (
                      <span className="inline-flex items-center gap-1 h-4 px-1 rounded bg-draft-tint text-draft-ink text-[10.5px] font-semibold">
                        <span className="size-1 rounded-full bg-primary" />
                        Draft ready
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border text-[12.5px] text-muted-foreground flex justify-between">
          <span>{threads.length} thread{threads.length !== 1 ? "s" : ""}</span>
          <span>
            {counts.draft > 0
              ? `${counts.draft} draft${counts.draft !== 1 ? "s" : ""} ready`
              : "Saathi ready"}
          </span>
        </div>
      </div>

      {/* ── Thread view ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-background min-w-0 min-h-0">
        {selectedContent ? (
          <SelectedThread content={selectedContent} threadId={selectedThreadId!} />
        ) : (
          <EmptyThreadState hasThreads={threads.length > 0} />
        )}
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */
function EmptyThreadState({ hasThreads }: { hasThreads: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <MessageSquare className="size-10 text-muted-foreground/30" strokeWidth={1.2} />
      <div>
        <p className="text-[15px] font-medium text-foreground/70">
          {hasThreads ? "Select a thread" : "Your inbox is empty"}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          {hasThreads
            ? "Click any thread on the left to read and reply."
            : "Connect Gmail in Settings to start syncing emails."}
        </p>
      </div>
      {!hasThreads && (
        <Link href="/settings/gmail" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Connect Gmail
        </Link>
      )}
    </div>
  );
}

/* ── Selected thread ─────────────────────────────────────────────────── */
function SelectedThread({
  content,
  threadId,
}: {
  content: {
    messages: (typeof emailMessages.$inferSelect)[];
    lead: typeof leads.$inferSelect | null;
    draft: typeof aiDrafts.$inferSelect | null;
    latestInbound: typeof emailMessages.$inferSelect | null;
    profile: { companyName: string; drafterProvider: string | null; drafterModel: string | null } | null;
    linkedCustomer: { id: string; customerCode: string; name: string } | null;
  };
  threadId: string;
}) {
  const { messages, lead, draft, latestInbound, profile, linkedCustomer } = content;
  const subject = messages.find((m) => m.subject)?.subject ?? "(no subject)";
  const toEmail = latestInbound?.fromEmail ?? lead?.primaryEmail ?? "";

  return (
    <>
      {/* Header */}
      <div className="px-7 pt-4 pb-3.5 border-b border-border flex items-start justify-between gap-4 bg-background">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="text-[19px] font-semibold -tracking-[0.012em]">{subject}</span>
            <Badge className="bg-info-tint text-info border-transparent">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          {lead && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground flex-wrap mt-1">
              {lead.source === "linkedin" && (
                <span className="h-[18px] px-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] bg-[#0A66C2]/10 text-[#0A66C2] flex items-center">in</span>
              )}
              <span className="text-foreground/85 font-medium">{lead.contactName || lead.primaryEmail}</span>
              {lead.company && <><span className="text-foreground/30">·</span><span>{lead.company}</span></>}
              <span className="text-foreground/30">·</span>
              <StageSelect leadId={lead.id} currentStage={lead.stage} />
              <span className="text-foreground/30">·</span>
              <CustomerLinkButton
                leadId={lead.id}
                leadContact={{ contactName: lead.contactName, primaryEmail: lead.primaryEmail, company: lead.company, phone: lead.phone }}
                customer={linkedCustomer}
              />
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Link
            href={`/inbox/${threadId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Layers className="size-3.5" /> Full view
          </Link>
          <Button variant="outline" size="icon-sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-7 pt-5 space-y-4 pb-4">
          {messages.map((msg) => {
            const inbound = msg.direction === "inbound";
            const author = inbound
              ? lead?.contactName ?? msg.fromEmail ?? "Unknown"
              : "You";
            const co = inbound ? lead?.company ?? "" : profile?.companyName ?? "White Pops";
            return (
              <div key={msg.id} className="flex gap-3.5 items-start">
                <SmartAvatar name={author} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                    <span className="text-[14px] font-semibold">{author}</span>
                    {co && <span className="text-[13px] text-muted-foreground">{co}</span>}
                    {!inbound && (
                      <Badge variant="outline" className="h-4 px-1 text-[11px]">You</Badge>
                    )}
                    <span className="text-[12px] text-muted-foreground ml-auto">
                      {formatDateTime(msg.receivedAt)}
                    </span>
                    <span className="ml-1">
                      {inbound
                        ? <ArrowDownRight className="size-3 text-muted-foreground" />
                        : <ArrowUpRight className="size-3 text-primary" />}
                    </span>
                  </div>
                  <div
                    className={`rounded-xl px-4 py-3 text-[14.5px] leading-[1.55] text-foreground/85 whitespace-pre-wrap break-words ${
                      inbound ? "bg-card border border-border" : "bg-draft-tint"
                    }`}
                  >
                    {msg.bodyText || <span className="italic text-muted-foreground">(no content)</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Draft compose area */}
        {latestInbound && !latestInbound.aiCategory ? (
          <div className="px-7 pb-6">
            <Card className="p-4 text-center space-y-2">
              <Sparkles className="size-6 text-muted-foreground mx-auto" />
              <p className="text-[14px] text-muted-foreground">
                This message hasn&apos;t been analyzed yet.
              </p>
              <Link href={`/inbox/${threadId}`} className={buttonVariants({ size: "sm" })}>
                <Sparkles className="size-3.5" /> Run AI Analysis
              </Link>
            </Card>
          </div>
        ) : latestInbound?.aiCategory && latestInbound.aiCategory !== "spam" && latestInbound.aiCategory !== "newsletter" ? (
          <div className="px-7 pb-6">
            <div className="rounded-xl overflow-hidden border border-[oklch(0.48_0.11_162/0.22)]">
              <DraftPanel
                draft={draft ? {
                  id: draft.id,
                  body: draft.draftBody,
                  editedBody: draft.editedBody,
                  status: draft.status as string,
                  gmailDraftId: draft.gmailDraftId,
                  inReplyToMessageId: draft.inReplyToMessageId ?? undefined,
                } : null}
                subject={subject}
                toEmail={toEmail}
                threadId={threadId}
                leadId={messages[0].leadId}
                aiCategory={latestInbound?.aiCategory ?? null}
                inboundProcessedAt={
                  latestInbound?.processedAt
                    ? new Date(latestInbound.processedAt).toISOString()
                    : null
                }
                inboundMessageId={latestInbound?.id ?? null}
                businessProfile={profile}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ── Small helpers ────────────────────────────────────────────────────── */

function FolderGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function FolderItem({
  Icon, label, count, active, hot, draft, href,
}: {
  Icon: typeof Mail; label: string; count: number;
  active?: boolean; hot?: boolean; draft?: boolean; href: string;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[14px] ${
        active
          ? "bg-card text-foreground font-medium shadow-[0_1px_0_rgba(20,14,8,.04),_0_1px_3px_rgba(20,14,8,.05)]"
          : "text-muted-foreground hover:bg-foreground/5"
      }`}
    >
      {active && <span className="absolute -left-3.5 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />}
      <Icon
        className={`size-3.5 shrink-0 ${draft ? "text-primary" : hot ? "text-warn" : "text-muted-foreground"}`}
        strokeWidth={1.5}
      />
      <span className="flex-1">{label}</span>
      <span
        className={`tabular text-[12px] font-semibold rounded-full px-1.5 ${
          active ? "bg-primary text-primary-foreground" : hot ? "bg-warn-tint text-warn" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const m = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
