import { eq } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";

import { db } from "@/db";
import {
  gmailAccount,
  emailMessages,
  leads,
  businessProfile,
  type EmailMessageMetadata,
} from "@/db/schema";
import { parseGmailMessage, type ParsedMessage } from "./parse";
import { getGmailConnection, type GmailConnection } from "./client";
import { nextLeadCode } from "@/lib/next-code";

const INITIAL_BACKFILL_COUNT = 50;
const BACKFILL_QUERY = "in:inbox newer_than:30d";

export interface SyncResult {
  inserted: number;
  skipped: number;
  filtered: number;
  errors: string[];
  newHistoryId: string | null;
  pendingClassifyIds: string[];
}

/**
 * Pull new Gmail messages and persist them. Two modes:
 *   - Backfill (no `lastHistoryId` stored yet): list the most recent N
 *     messages, ingest them, snapshot the current historyId.
 *   - Incremental (we have `lastHistoryId`): use `users.history.list` to find
 *     only message-added events since then.
 */
export async function syncGmail(): Promise<SyncResult> {
  const conn = await getGmailConnection();
  if (!conn) {
    return {
      inserted: 0,
      skipped: 0,
      filtered: 0,
      errors: ["Gmail account is not connected"],
      newHistoryId: null,
      pendingClassifyIds: [],
    };
  }

  const account = await db.query.gmailAccount.findFirst({
    where: eq(gmailAccount.id, conn.accountId),
  });
  if (!account) {
    return {
      inserted: 0,
      skipped: 0,
      filtered: 0,
      errors: ["Gmail account row vanished mid-sync"],
      newHistoryId: null,
      pendingClassifyIds: [],
    };
  }

  const result: SyncResult = {
    inserted: 0,
    skipped: 0,
    filtered: 0,
    errors: [],
    newHistoryId: null,
    pendingClassifyIds: [],
  };

  let historyExpired = false;

  try {
    if (!account.lastHistoryId) {
      await backfill(conn, result);
    } else {
      await incrementalSync(conn, account.lastHistoryId, result, () => {
        historyExpired = true;
      });
    }

    if (!historyExpired) {
      const profile = await conn.gmail.users.getProfile({ userId: "me" });
      const historyId = profile.data.historyId ?? null;
      result.newHistoryId = historyId;

      const now = new Date();
      await db
        .update(gmailAccount)
        .set({
          lastHistoryId: historyId,
          lastPolledAt: now,
          lastSuccessAt: now,
          // Clear any prior failure once a sync round-trips cleanly.
          lastErrorKind: null,
          lastErrorMessage: null,
          lastErrorAt: null,
          updatedAt: now,
        })
        .where(eq(gmailAccount.id, conn.accountId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    const kind = classifyGmailError(err);
    const now = new Date();
    try {
      await db
        .update(gmailAccount)
        .set({
          lastPolledAt: now,
          lastErrorKind: kind,
          lastErrorMessage: message.slice(0, 1000),
          lastErrorAt: now,
          updatedAt: now,
        })
        .where(eq(gmailAccount.id, conn.accountId));
    } catch {
      // Never let an error-logging update mask the original failure.
    }
  } finally {
    await conn.flush();
  }

  return result;
}

/**
 * Coarse bucketing of Gmail API failures so the UI can pick the right CTA:
 *   - "auth"        → user needs to reconnect
 *   - "rate_limit"  → wait it out
 *   - "transient"   → retry later (network, 5xx)
 */
function classifyGmailError(err: unknown): "auth" | "rate_limit" | "transient" {
  const e = err as {
    code?: number;
    status?: number;
    response?: { status?: number };
    message?: string;
  };
  const status = e.code ?? e.status ?? e.response?.status;
  const msg = (e.message ?? "").toLowerCase();

  if (status === 401 || msg.includes("invalid_grant") || msg.includes("invalid_token")) {
    return "auth";
  }
  if (status === 403 && (msg.includes("rate") || msg.includes("quota"))) {
    return "rate_limit";
  }
  if (status === 429) return "rate_limit";
  if (status === 403) return "auth"; // scope/permission problems are also "reconnect"
  return "transient";
}

async function backfill(
  conn: GmailConnection,
  result: SyncResult,
): Promise<void> {
  const listed = await conn.gmail.users.messages.list({
    userId: "me",
    q: BACKFILL_QUERY,
    maxResults: INITIAL_BACKFILL_COUNT,
  });
  const messages = listed.data.messages ?? [];

  const concurrency = 5;
  for (let i = 0; i < messages.length; i += concurrency) {
    const batch = messages.slice(i, i + concurrency);
    const outcomes = await Promise.allSettled(
      batch.map((stub) => {
        if (!stub.id) return;
        return ingestMessageById(conn, stub.id, result);
      }),
    );
    for (const o of outcomes) {
      if (o.status === "rejected") {
        result.errors.push(String(o.reason));
      }
    }
  }
}

async function incrementalSync(
  conn: GmailConnection,
  startHistoryId: string,
  result: SyncResult,
  onExpired?: () => void,
): Promise<void> {
  let pageToken: string | undefined = undefined;
  const seen = new Set<string>();

  do {
    let history: gmail_v1.Schema$ListHistoryResponse;
    try {
      const res: { data: gmail_v1.Schema$ListHistoryResponse } =
        await conn.gmail.users.history.list({
          userId: "me",
          startHistoryId,
          historyTypes: ["messageAdded"],
          pageToken,
        });
      history = res.data;
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 404) {
        await db
          .update(gmailAccount)
          .set({ lastHistoryId: null })
          .where(eq(gmailAccount.id, conn.accountId));
        result.errors.push(
          "Gmail history window expired; will backfill on next run",
        );
        onExpired?.();
        return;
      }
      throw err;
    }

    for (const h of history.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        const id = added.message?.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        await ingestMessageById(conn, id, result);
      }
    }
    pageToken = history.nextPageToken ?? undefined;
  } while (pageToken);
}

async function ingestMessageById(
  conn: GmailConnection,
  messageId: string,
  result: SyncResult,
): Promise<void> {
  const already = await db.query.emailMessages.findFirst({
    where: eq(emailMessages.gmailMessageId, messageId),
  });
  if (already) {
    result.skipped += 1;
    return;
  }

  try {
    const { data } = await conn.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const parsed = parseGmailMessage(data);
    if (!parsed) {
      result.errors.push(`Could not parse message ${messageId}`);
      return;
    }
    const persisted = await persistMessage(parsed);
    if (persisted) {
      result.inserted += 1;
      if (!parsed.isOutbound) {
        result.pendingClassifyIds.push(parsed.gmailMessageId);
      }
    } else {
      result.filtered += 1;
    }
  } catch (err) {
    result.errors.push(
      `${messageId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Insert message and find-or-create lead in a single transaction.
 *
 * Lead-matching rule: dedup by the "other party" email. For inbound, that's
 * the sender. For outbound, it's the first recipient.
 *
 * Special handling:
 * - LinkedIn notifications: mark source="linkedin"
 * - Forwarded emails: if from internal team member to the CRM inbox, and
 *   contains an original external sender, treat as referral.
 *
 * Threads are implicit — grouped by gmail_thread_id on the message.
 *
 * Returns true if the message was persisted, false if filtered out.
 */
async function persistMessage(msg: ParsedMessage): Promise<boolean> {
  const [profile, gmail] = await Promise.all([
    db.query.businessProfile.findFirst(),
    db.query.gmailAccount.findFirst(),
  ]);

  const keywords: string[] =
    (profile?.inboxKeywords as string[] | undefined) ?? ["makhana"];

  const internalEmails = new Set<string>();
  if (gmail?.email) internalEmails.add(gmail.email.toLowerCase());
  const allowedEmails = (profile?.allowedEmails as Array<{ email: string }> | undefined) ?? [];
  for (const a of allowedEmails) {
    if (a.email) internalEmails.add(a.email.toLowerCase());
  }

  const existingInThread = await db.query.emailMessages.findFirst({
    where: eq(emailMessages.gmailThreadId, msg.gmailThreadId),
    columns: { id: true },
  });
  if (existingInThread) {
    return doPersist(msg, internalEmails);
  }

  if (msg.isOutbound) return false;

  const textToCheck =
    `${msg.subject ?? ""} ${msg.bodyText ?? ""}`.toLowerCase();
  const matches = keywords.some((kw) => textToCheck.includes(kw.toLowerCase()));
  if (!matches) return false;

  return doPersist(msg, internalEmails);
}

async function doPersist(msg: ParsedMessage, internalEmails: Set<string>): Promise<boolean> {
  let effectiveOtherPartyEmail: string | null;
  let effectiveContactName: string | null;
  let source: "linkedin" | "gmail_direct" | "referral";
  let isInternalForward = false;

  if (msg.isOutbound) {
    effectiveOtherPartyEmail = msg.toEmails[0] ?? null;
    effectiveContactName = null;
    source = "gmail_direct";
  } else if (msg.forwarded?.isForwarded && msg.forwarded.originalFromEmail) {
    const forwarderEmail = msg.forwarded.forwarderEmail?.toLowerCase();
    const originalEmail = msg.forwarded.originalFromEmail.toLowerCase();
    const originalIsInternal = internalEmails.has(originalEmail);

    if (forwarderEmail && internalEmails.has(forwarderEmail) && !originalIsInternal) {
      isInternalForward = true;
      effectiveOtherPartyEmail = originalEmail;
      effectiveContactName = msg.forwarded.originalFromName;
      source = "referral";
    } else {
      effectiveOtherPartyEmail = msg.fromEmail;
      effectiveContactName = msg.fromName;
      source = "gmail_direct";
    }
  } else if (msg.isLinkedInNotification) {
    effectiveOtherPartyEmail = msg.fromEmail;
    effectiveContactName = msg.fromName;
    source = "linkedin";
  } else {
    effectiveOtherPartyEmail = msg.fromEmail;
    effectiveContactName = msg.fromName;
    source = "gmail_direct";
  }

  if (!effectiveOtherPartyEmail) return false;

  const emailMetadata: EmailMessageMetadata = {};
  if (msg.isLinkedInNotification) {
    emailMetadata.isLinkedInNotification = true;
  }
  if (msg.forwarded?.isForwarded) {
    emailMetadata.forwarded = {
      originalFromName: msg.forwarded.originalFromName,
      originalFromEmail: msg.forwarded.originalFromEmail,
      originalSubject: msg.forwarded.originalSubject,
      originalDate: msg.forwarded.originalDate,
      originalTo: msg.forwarded.originalTo,
      forwarderName: msg.forwarded.forwarderName,
      forwarderEmail: msg.forwarded.forwarderEmail,
      isInternalForward,
    };
  }

  await db.transaction(async (tx) => {
    let leadId: string | null = null;

    const existingMsg = await tx.query.emailMessages.findFirst({
      where: eq(emailMessages.gmailThreadId, msg.gmailThreadId),
      columns: { leadId: true },
    });
    if (existingMsg) {
      leadId = existingMsg.leadId;
    }

    if (!leadId) {
      const code = await nextLeadCode();
      const [newLead] = await tx
        .insert(leads)
        .values({
          leadCode: code,
          primaryEmail: effectiveOtherPartyEmail.toLowerCase(),
          contactName: effectiveContactName,
          source,
          stage: "new",
          firstContactAt: msg.receivedAt,
          lastActivityAt: msg.receivedAt,
        })
        .returning();
      leadId = newLead.id;
    }

    const hasMetadata = Object.keys(emailMetadata).length > 0 || emailMetadata.forwarded;

    await tx.insert(emailMessages).values({
      leadId,
      gmailThreadId: msg.gmailThreadId,
      gmailMessageId: msg.gmailMessageId,
      direction: msg.isOutbound ? "outbound" : "inbound",
      fromEmail: msg.fromEmail,
      toEmails: msg.toEmails,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      bodyText: msg.bodyText,
      bodyHtml: msg.bodyHtml,
      emailMetadata: hasMetadata ? emailMetadata : undefined,
    });

    await tx
      .update(leads)
      .set({ lastActivityAt: msg.receivedAt })
      .where(eq(leads.id, leadId));
  });

  return true;
}
