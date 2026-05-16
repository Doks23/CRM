import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiDrafts, draftEditPairs, emailMessages, leads } from "@/db/schema";
import { createGmailDraft, sendGmailDraft } from "@/lib/gmail/draft";
import { computeEditRatio } from "@/lib/text-diff";
import { auth } from "@/auth";

const STAGE_ORDER = ["new", "needs_review", "qualified", "info_sent", "negotiation", "po_received", "dispatched", "won", "lost", "nurture"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { draftId, action, clientSendKey } = body as {
    draftId?: string;
    action?: "discard";
    clientSendKey?: string;
    [k: string]: unknown;
  };

  if (!draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }

  const draft = await db.query.aiDrafts.findFirst({
    where: eq(aiDrafts.id, draftId),
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (action === "discard") {
    await db
      .update(aiDrafts)
      .set({ status: "discarded" })
      .where(eq(aiDrafts.id, draftId));

    return NextResponse.json({ status: "discarded" });
  }

  // Idempotency: if this retry arrives with the same clientSendKey that we
  // already marked sent for, return the prior success instead of re-sending.
  if (
    clientSendKey &&
    draft.clientSendKey === clientSendKey &&
    draft.sentMessageId
  ) {
    return NextResponse.json({
      status: "sent",
      sentMessageId: draft.sentMessageId,
      idempotent: true,
    });
  }

  if (draft.status === "sent") {
    return NextResponse.json(
      { error: "Draft already sent", sentMessageId: draft.sentMessageId },
      { status: 409 },
    );
  }

  const finalBody =
    body.editedBody && body.editedBody !== draft.draftBody
      ? body.editedBody
      : draft.draftBody;

  const isEdited = finalBody !== draft.draftBody;

  try {
    const message = draft.inReplyToMessageId
      ? await db.query.emailMessages.findFirst({
          where: eq(emailMessages.id, draft.inReplyToMessageId),
        })
      : null;

    const threadId = body.threadId ?? message?.gmailThreadId ?? "";
    const toEmail = body.toEmail ?? message?.fromEmail ?? "";
    const subject = body.subject ?? message?.subject ?? "";

    if (!toEmail) {
      return NextResponse.json(
        { error: "Recipient email is required" },
        { status: 400 },
      );
    }

    if (!threadId) {
      return NextResponse.json(
        { error: "Cannot determine Gmail thread ID" },
        { status: 400 },
      );
    }

    // Persist the send key BEFORE calling Gmail so a crash mid-flight leaves
    // a paper trail. The retry path above relies on this row already having
    // the key set.
    if (clientSendKey && draft.clientSendKey !== clientSendKey) {
      await db
        .update(aiDrafts)
        .set({ clientSendKey })
        .where(eq(aiDrafts.id, draftId));
    }

    // Reuse an already-created Gmail draft if a previous attempt got that far
    // but failed before send completed. Without this, retries duplicate the
    // Gmail Draft in the user's drafts folder.
    let gmailDraftId = draft.gmailDraftId;
    if (!gmailDraftId) {
      gmailDraftId = await createGmailDraft({
        to: toEmail,
        subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
        body: finalBody,
        threadId,
      });

      if (!gmailDraftId) {
        return NextResponse.json(
          { error: "Gmail account not connected" },
          { status: 500 },
        );
      }

      // Save the Gmail draft id immediately, before we attempt to send it.
      // A retry now finds gmailDraftId set and skips re-creation.
      await db
        .update(aiDrafts)
        .set({ gmailDraftId })
        .where(eq(aiDrafts.id, draftId));
    }

    const sentMessageId = await sendGmailDraft(gmailDraftId);

    if (!sentMessageId) {
      return NextResponse.json(
        { error: "Gmail returned no sent message ID" },
        { status: 500 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(aiDrafts)
        .set({
          status: "sent",
          editedBody: isEdited ? finalBody : null,
          gmailDraftId,
          sentMessageId,
          sentAt: new Date(),
          sentBy: session.user!.id,
        })
        .where(eq(aiDrafts.id, draftId));

      const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, draft.leadId),
      });
      const currentIdx = lead ? STAGE_ORDER.indexOf(lead.stage) : -1;
      const infoSentIdx = STAGE_ORDER.indexOf("info_sent");
      if (currentIdx >= 0 && currentIdx < infoSentIdx) {
        await tx
          .update(leads)
          .set({ stage: "info_sent", lastActivityAt: new Date() })
          .where(eq(leads.id, draft.leadId));
      } else {
        await tx
          .update(leads)
          .set({ lastActivityAt: new Date() })
          .where(eq(leads.id, draft.leadId));
      }

      if (toEmail) {
        const account = await tx.query.gmailAccount.findFirst();
        if (account) {
          await tx.insert(emailMessages).values({
            leadId: draft.leadId,
            gmailThreadId: threadId,
            gmailMessageId: sentMessageId,
            direction: "outbound",
            fromEmail: account.email,
            toEmails: [toEmail],
            subject,
            bodyText: finalBody,
            receivedAt: new Date(),
          }).onConflictDoNothing({ target: emailMessages.gmailMessageId });
        }
      }

      // Capture edit-pair on every send (even unedited — "0% edited" is also
      // signal). Tone-learning prompts will sample these later. We only
      // store when there was an AI draft to compare against; manually-typed
      // replies wouldn't be there anyway because they don't flow through here.
      await tx.insert(draftEditPairs).values({
        leadId: draft.leadId,
        draftId: draft.id,
        originalBody: draft.draftBody,
        finalBody,
        editRatio: computeEditRatio(draft.draftBody, finalBody).toFixed(3),
        language: draft.language,
        sentBy: session.user!.id,
      });
    });

    return NextResponse.json({ status: "sent", sentMessageId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
