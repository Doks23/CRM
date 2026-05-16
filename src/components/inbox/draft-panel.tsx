"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Pause,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DraftData {
  id: string;
  body: string;
  editedBody: string | null;
  status: string;
  gmailDraftId: string | null;
  inReplyToMessageId?: string;
}

interface BusinessProfileData {
  companyName: string;
  drafterProvider: string | null;
  drafterModel: string | null;
}

interface Props {
  draft: DraftData | null;
  subject: string;
  toEmail: string;
  threadId: string;
  leadId: string;
  aiCategory: string | null;
  /** ISO string of when the latest inbound message was classified. Used to
   *  detect a stuck "drafting" state so we can show a retry instead of a
   *  perpetual spinner. */
  inboundProcessedAt: string | null;
  /** UUID of the latest inbound message — used as inReplyToMessageId when
   *  the panel needs to kick a regenerate manually (e.g. stuck state). */
  inboundMessageId: string | null;
  businessProfile: BusinessProfileData | null;
}

// If the AI draft hasn't appeared within this many seconds of classification
// finishing, we assume the worker is wedged or the cap blocked it.
const DRAFT_TIMEOUT_SECONDS = 60;
// Fetch-side timeout for regenerate/send so the UI never hangs forever.
const FETCH_TIMEOUT_MS = 60_000;

export function DraftPanel({
  draft,
  subject,
  toEmail,
  threadId,
  leadId,
  aiCategory,
  inboundProcessedAt,
  inboundMessageId,
  businessProfile,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editedBody, setEditedBody] = useState(
    draft?.editedBody ?? draft?.body ?? "",
  );
  const [error, setError] = useState<DraftError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRewrite, setShowRewrite] = useState(false);
  const [rewriteInstructions, setRewriteInstructions] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Refresh server state every 8s while we're waiting on a draft, so the
  // panel transitions from "drafting" → "ready" without the user clicking.
  const isWaitingForDraft =
    !draft &&
    (aiCategory === "relevant" || aiCategory === "cold") &&
    !!inboundProcessedAt;

  useEffect(() => {
    if (!isWaitingForDraft) return;
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [isWaitingForDraft, router]);

  // No draft surface for categories where we never reply.
  if (!aiCategory || aiCategory === "spam" || aiCategory === "newsletter") {
    return null;
  }

  // ── State 1: awaiting a fresh draft (or stuck) ────────────────────────
  if (!draft) {
    if (aiCategory !== "relevant" && aiCategory !== "cold") return null;

    const elapsedSec = inboundProcessedAt
      ? Math.floor((Date.now() - new Date(inboundProcessedAt).getTime()) / 1000)
      : 0;
    const isStuck = elapsedSec > DRAFT_TIMEOUT_SECONDS;

    return (
      <div className="border-t bg-white dark:bg-zinc-950 px-6 py-4">
        <div className="max-w-3xl mx-auto w-full space-y-3">
          {isStuck ? (
            <StuckDraftCard
              error={error}
              isRegenerating={isRegenerating}
              onRetry={async () => {
                await regenerateDraft({
                  leadId,
                  inReplyToMessageId: inboundMessageId ?? "",
                  instructions: null,
                  setIsRegenerating,
                  setError,
                  onDone: () => router.refresh(),
                });
              }}
            />
          ) : (
            <DraftingSpinner profile={businessProfile} elapsedSec={elapsedSec} />
          )}
        </div>
      </div>
    );
  }

  // ── State 2: draft exists ─────────────────────────────────────────────

  // Discarded — don't show the editor; offer to start a new one.
  if (draft.status === "discarded") {
    return (
      <div className="border-t bg-white dark:bg-zinc-950 px-6 py-4">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <X className="h-4 w-4" />
            <span>Draft was discarded.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isRegenerating || !inboundMessageId}
            onClick={async () => {
              await regenerateDraft({
                leadId,
                inReplyToMessageId: inboundMessageId ?? draft.inReplyToMessageId ?? "",
                instructions: null,
                setIsRegenerating,
                setError,
                onDone: () => router.refresh(),
              });
            }}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 mr-1", isRegenerating && "animate-spin")}
            />
            {isRegenerating ? "Generating…" : "Generate a new draft"}
          </Button>
        </div>
        {error ? <ErrorBlock error={error} /> : null}
      </div>
    );
  }

  // Sent — show a quiet confirmation.
  if (draft.status === "sent") {
    return (
      <div className="border-t bg-primary/5 px-6 py-3">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-2 text-sm text-primary">
          <Send className="h-3.5 w-3.5" />
          <span>Reply sent.</span>
        </div>
      </div>
    );
  }

  // Pending / approved / edited → full editor.
  const handleSend = async () => {
    setError(null);
    setSuccess(null);

    // Generate ONE key per logical send attempt. A network-level retry inside
    // the same attempt re-uses this key so the server can dedupe.
    const clientSendKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    startTransition(async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/inbox/send", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: draft.id,
            clientSendKey,
            editedBody: editedBody !== draft.body ? editedBody : null,
            threadId,
            leadId,
            toEmail,
            subject,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw responseToError(res.status, data);
        }
        setSuccess(
          data.idempotent ? "Already sent — confirmed." : "Reply sent!",
        );
        setTimeout(() => router.push("/inbox"), 1500);
      } catch (err) {
        setError(toDraftError(err, "Send failed"));
      } finally {
        clearTimeout(timer);
      }
    });
  };

  const handleDiscard = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/inbox/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: draft.id, action: "discard" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw responseToError(res.status, data);
        }
        router.refresh();
      } catch (err) {
        setError(toDraftError(err, "Discard failed"));
      }
    });
  };

  const handleRegenerate = async (instructions: string | null) => {
    await regenerateDraft({
      leadId,
      inReplyToMessageId:
        inboundMessageId ?? draft.inReplyToMessageId ?? "",
      instructions,
      setIsRegenerating,
      setError,
      onDone: (body) => {
        if (body) setEditedBody(body);
        setShowRewrite(false);
        setRewriteInstructions("");
      },
    });
  };

  return (
    <div className="border-t bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto w-full p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Draft</span>
            <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">
              {draft.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            To: {toEmail}
          </div>
        </div>

        <textarea
          value={editedBody}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setEditedBody(e.target.value)
          }
          className="min-h-[160px] text-sm resize-y w-full rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Edit draft before sending…"
        />

        {error ? <ErrorBlock error={error} /> : null}
        {success ? <p className="text-xs text-primary">{success}</p> : null}

        {showRewrite ? (
          <div className="space-y-2 rounded-md border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Instructions for rewrite:
            </p>
            <textarea
              value={rewriteInstructions}
              onChange={(e) => setRewriteInstructions(e.target.value)}
              placeholder="e.g., Make it shorter, emphasise our quality, mention MOQ discount, be more formal…"
              className="min-h-[60px] text-sm resize-y w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRewrite(false);
                  setRewriteInstructions("");
                }}
                disabled={isRegenerating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleRegenerate(rewriteInstructions.trim() || null)
                }
                disabled={isRegenerating}
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5 mr-1",
                    isRegenerating && "animate-spin",
                  )}
                />
                {isRegenerating ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowRewrite(!showRewrite);
              setRewriteInstructions("");
            }}
            disabled={isPending || isRegenerating}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Rewrite
          </Button>
          <Button size="sm" onClick={handleSend} disabled={isPending}>
            <Send className="h-3.5 w-3.5 mr-1" />
            {isPending ? "Sending…" : "Approve & Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function DraftingSpinner({
  profile,
  elapsedSec,
}: {
  profile: BusinessProfileData | null;
  elapsedSec: number;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 animate-pulse text-primary" />
      <span>
        AI is generating a draft
        {profile
          ? ` via ${profile.drafterProvider}/${profile.drafterModel}`
          : ""}
        …
      </span>
      <span className="text-xs">({elapsedSec}s)</span>
    </div>
  );
}

function StuckDraftCard({
  error,
  isRegenerating,
  onRetry,
}: {
  error: DraftError | null;
  isRegenerating: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Draft generation hasn't completed yet
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The worker may be busy, the AI cap may be reached, or an error
            blocked it. Try again — if it keeps failing, check{" "}
            <Link href="/reports" className="underline">
              Reports
            </Link>{" "}
            for the AI activity log.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={isRegenerating}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5 mr-1", isRegenerating && "animate-spin")}
          />
          {isRegenerating ? "Retrying…" : "Try again"}
        </Button>
      </div>
      {error ? <ErrorBlock error={error} /> : null}
    </div>
  );
}

function ErrorBlock({ error }: { error: DraftError }) {
  if (error.kind === "cap_blocked") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2 text-xs">
        <Pause className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-200">
            AI is paused — daily cost cap reached
          </p>
          <p className="text-muted-foreground mt-0.5">
            Spent ₹{error.spentInr.toFixed(2)} of ₹{error.capInr.toFixed(2)}{" "}
            today. Raise the cap in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>{" "}
            or wait for tomorrow.
          </p>
        </div>
      </div>
    );
  }
  return <p className="text-xs text-destructive">{error.message}</p>;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type DraftError =
  | { kind: "generic"; message: string }
  | { kind: "cap_blocked"; capInr: number; spentInr: number; message: string };

function responseToError(
  status: number,
  data: Record<string, unknown> & {
    error?: string;
    code?: string;
    capInr?: number;
    spentInr?: number;
  },
): DraftError {
  if (status === 429 && data.code === "cost_cap_exceeded") {
    return {
      kind: "cap_blocked",
      capInr: Number(data.capInr ?? 0),
      spentInr: Number(data.spentInr ?? 0),
      message: data.error ?? "AI cost cap reached",
    };
  }
  return { kind: "generic", message: data.error ?? `HTTP ${status}` };
}

function toDraftError(err: unknown, fallback: string): DraftError {
  if (err && typeof err === "object" && "kind" in err) return err as DraftError;
  if (err instanceof DOMException && err.name === "AbortError") {
    return {
      kind: "generic",
      message: "Timed out after 60s. Try again or check the AI activity log.",
    };
  }
  return {
    kind: "generic",
    message: err instanceof Error ? err.message : fallback,
  };
}

async function regenerateDraft(opts: {
  leadId: string;
  inReplyToMessageId: string;
  instructions: string | null;
  setIsRegenerating: (v: boolean) => void;
  setError: (e: DraftError | null) => void;
  onDone?: (body: string | null) => void;
}) {
  opts.setError(null);
  opts.setIsRegenerating(true);

  if (!opts.inReplyToMessageId) {
    opts.setIsRegenerating(false);
    opts.setError({
      kind: "generic",
      message: "Cannot regenerate: no inbound message linked.",
    });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/inbox/regenerate", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: opts.leadId,
        inReplyToMessageId: opts.inReplyToMessageId,
        instructions: opts.instructions ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw responseToError(res.status, data);
    opts.onDone?.(data.body ?? null);
  } catch (err) {
    opts.setError(toDraftError(err, "Regeneration failed"));
  } finally {
    clearTimeout(timer);
    opts.setIsRegenerating(false);
  }
}
