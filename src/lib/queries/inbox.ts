/**
 * Shared inbox query layer.
 *
 * Server components use `listInboxThreads()` directly for SSR. The
 * `/api/inbox/threads` route wraps the same function to return JSON for
 * the future mobile client. Keep all inbox SQL in here so both stay in
 * sync — never inline this query in a page or component.
 */

import { and, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiDrafts, emailMessages, leads } from "@/db/schema";

export type InboxFilter = "all" | "new" | "draft" | "ignored";

export interface InboxThreadRow {
  gmailThreadId: string;
  leadId: string;
  leadCode: string;
  contactName: string | null;
  primaryEmail: string;
  company: string | null;
  subject: string | null;
  lastMessageAt: Date | null;
  latestSnippet: string | null;
  latestDirection: "inbound" | "outbound" | null;
  latestAiCategory: string | null;
  latestDraftStatus: "pending" | "approved" | "edited" | null;
  messageCount: number;
  leadType: string | null;
  stage: string | null;
  score: number | null;
}

export interface ListInboxOptions {
  filter?: InboxFilter;
  query?: string | null;
  limit?: number;
}

const DEFAULT_LIMIT = 100;

/**
 * One row per thread, ordered by most-recent activity.
 *
 * Filters are applied AFTER per-thread aggregation so they can use the
 * derived "latest" fields without re-running the sub-queries.
 */
export async function listInboxThreads({
  filter = "all",
  query,
  limit = DEFAULT_LIMIT,
}: ListInboxOptions = {}): Promise<InboxThreadRow[]> {
  const q = query?.trim();

  const conditions = [];

  // Soft-deleted leads are never visible anywhere in the inbox.
  conditions.push(sql`${leads.deletedAt} is null`);

  // Hide categories we never want to surface in the operator inbox.
  // Parenthesized so the OR doesn't swallow sibling conditions added below.
  conditions.push(
    sql`((
      select m.ai_category from ${emailMessages} m
      where m.gmail_thread_id = ${emailMessages.gmailThreadId}
      order by m.received_at desc limit 1
    ) is null or (
      select m.ai_category from ${emailMessages} m
      where m.gmail_thread_id = ${emailMessages.gmailThreadId}
      order by m.received_at desc limit 1
    ) not in ('spam', 'newsletter'))`,
  );

  // Ignored is its own tab — exclude it from every other view.
  if (filter !== "ignored") {
    conditions.push(sql`${leads.stage} <> 'ignored'`);
  }

  if (q) {
    conditions.push(
      or(
        ilike(leads.contactName, `%${q}%`),
        ilike(leads.primaryEmail, `%${q}%`),
        ilike(leads.company, `%${q}%`),
        sql`exists (
          select 1 from ${emailMessages} m
          where m.gmail_thread_id = ${emailMessages.gmailThreadId}
          and (m.subject ilike ${`%${q}%`} or m.body_text ilike ${`%${q}%`})
        )`,
      )!,
    );
  }

  if (filter === "new") {
    // Latest message is inbound AND no unsent draft exists yet.
    conditions.push(
      sql`(
        select m.direction from ${emailMessages} m
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
        order by m.received_at desc limit 1
      ) = 'inbound'`,
      sql`not exists (
        select 1 from ${aiDrafts} d
        inner join ${emailMessages} m on m.id = d.in_reply_to_message_id
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
          and d.status in ('pending', 'approved', 'edited')
          and d.sent_at is null
      )`,
    );
  }

  if (filter === "draft") {
    conditions.push(
      sql`exists (
        select 1 from ${aiDrafts} d
        inner join ${emailMessages} m on m.id = d.in_reply_to_message_id
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
          and d.status in ('pending', 'approved', 'edited')
          and d.sent_at is null
      )`,
    );
  }

  if (filter === "ignored") {
    conditions.push(sql`${leads.stage} = 'ignored'`);
  }

  const rows = await db
    .select({
      gmailThreadId: emailMessages.gmailThreadId,
      leadId: leads.id,
      leadCode: leads.leadCode,
      contactName: leads.contactName,
      primaryEmail: leads.primaryEmail,
      company: leads.company,
      leadType: leads.leadType,
      stage: leads.stage,
      score: leads.score,
      subject: sql<string | null>`(
        select m.subject from ${emailMessages} m
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
        order by m.received_at asc limit 1
      )`,
      lastMessageAt: sql<Date>`max(${emailMessages.receivedAt})`,
      latestSnippet: sql<string | null>`(
        select substring(coalesce(m.body_text, '') from 1 for 200)
        from ${emailMessages} m
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
        order by m.received_at desc limit 1
      )`,
      latestDirection: sql<"inbound" | "outbound" | null>`(
        select m.direction from ${emailMessages} m
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
        order by m.received_at desc limit 1
      )`,
      latestAiCategory: sql<string | null>`(
        select m.ai_category from ${emailMessages} m
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
        order by m.received_at desc limit 1
      )`,
      latestDraftStatus: sql<"pending" | "approved" | "edited" | null>`(
        select d.status from ${aiDrafts} d
        inner join ${emailMessages} m on m.id = d.in_reply_to_message_id
        where m.gmail_thread_id = ${emailMessages.gmailThreadId}
          and d.status in ('pending', 'approved', 'edited')
          and d.sent_at is null
        order by d.created_at desc limit 1
      )`,
      messageCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(emailMessages)
    .innerJoin(leads, sql`${leads.id} = ${emailMessages.leadId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(
      emailMessages.gmailThreadId,
      leads.id,
      leads.leadCode,
      leads.contactName,
      leads.primaryEmail,
      leads.company,
      leads.leadType,
      leads.stage,
      leads.score,
    )
    .orderBy(sql`max(${emailMessages.receivedAt}) desc`)
    .limit(limit);

  return rows;
}

/** Counts for sidebar folders — same conditions as above, kept tiny. */
export async function countInboxTabs(query?: string | null): Promise<{
  all: number;
  new: number;
  draft: number;
  ignored: number;
}> {
  const [all, newMails, drafts, ignored] = await Promise.all([
    listInboxThreads({ filter: "all", query, limit: 1000 }),
    listInboxThreads({ filter: "new", query, limit: 1000 }),
    listInboxThreads({ filter: "draft", query, limit: 1000 }),
    listInboxThreads({ filter: "ignored", query, limit: 1000 }),
  ]);
  return {
    all: all.length,
    new: newMails.length,
    draft: drafts.length,
    ignored: ignored.length,
  };
}
