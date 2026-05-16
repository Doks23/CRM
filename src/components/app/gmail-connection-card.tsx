"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, RefreshCw, Pause, Play, Save } from "lucide-react";

interface Props {
  status: "connected" | "disconnected";
  email?: string;
  lastPolledAt?: string | null;
  lastHistoryId?: string | null;
  messageCount?: number;
  inboundCount?: number;
  outboundCount?: number;
  banner?: { kind: "ok" | "error"; text: string } | null;
  isOwner: boolean;
  gmailSyncEnabled: boolean;
  pollIntervalMinutes: number;
  /** Health surface. When `errorKind` is set the connection card shows a
   *  prominent red/amber banner with a contextual action. */
  health?: {
    errorKind: "auth" | "rate_limit" | "transient" | null;
    errorMessage: string | null;
    errorAt: string | null;
    successAt: string | null;
  };
}

// Values are minutes. `0` means "no skip" — the gmail-poll cron fires every
// 2 minutes and a 0 interval lets every cron tick actually sync.
const INTERVAL_OPTIONS = [
  { value: 0, label: "As fast as possible" },
  { value: 5, label: "Every 5 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 120, label: "Every 2 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Once a day" },
];

export function GmailConnectionCard(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(props.gmailSyncEnabled);
  const [pollInterval, setPollInterval] = useState(props.pollIntervalMinutes);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDone, setSaveDone] = useState(false);

  function onSyncNow() {
    setSyncing(true);
    fetch("/api/gmail/sync", { method: "POST" })
      .then(() => {
        setTimeout(() => {
          startTransition(() => router.refresh());
          setSyncing(false);
        }, 2500);
      })
      .catch(() => setSyncing(false));
  }

  function onSaveSyncSettings() {
    setSaving(true);
    setSaveError(null);
    setSaveDone(false);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gmailSyncEnabled: syncEnabled,
        pollIntervalMinutes: pollInterval,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to save");
        }
        setSaveDone(true);
        router.refresh();
        setTimeout(() => setSaveDone(false), 2000);
      })
      .catch((err) => setSaveError(err.message))
      .finally(() => setSaving(false));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Gmail connection
            <Badge variant="outline" className="font-normal">
              Milestone 1
            </Badge>
          </CardTitle>
          {props.status === "connected" ? (
            <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/15">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
        <CardDescription>
          Shared inbox the CRM reads from and drafts back into.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.banner ? (
          <div
            className={
              "flex items-start gap-2 rounded-md border p-3 text-sm " +
              (props.banner.kind === "ok"
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-destructive/30 bg-destructive/5 text-destructive")
            }
          >
            {props.banner.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{props.banner.text}</span>
          </div>
        ) : null}

        <HealthBanner health={props.health} />

        {props.status === "connected" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Account" value={props.email ?? "—"} />
              <Stat
                label="Last poll"
                value={
                  props.lastPolledAt
                    ? new Date(props.lastPolledAt).toLocaleString()
                    : "Never"
                }
              />
              <Stat label="Messages" value={String(props.messageCount ?? 0)} />
              <Stat
                label="Inbound / Outbound"
                value={`${props.inboundCount ?? 0} / ${props.outboundCount ?? 0}`}
              />
            </div>

            {props.isOwner ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={onSyncNow}
                  disabled={syncing || pending}
                >
                  <RefreshCw className={"h-3.5 w-3.5 mr-1.5 " + (syncing ? "animate-spin" : "")} />
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
                <a
                  href="/api/gmail/connect"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline")}
                >
                  Reconnect
                </a>
              </div>
            ) : null}

            {props.isOwner ? (
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sync settings
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSyncEnabled(!syncEnabled)}
                    className={
                      "relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                      (syncEnabled ? "bg-primary" : "bg-muted")
                    }
                    role="switch"
                    aria-checked={syncEnabled}
                  >
                    <span
                      className={
                        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform " +
                        (syncEnabled ? "translate-x-4" : "translate-x-0")
                      }
                    />
                  </button>
                  <span className="text-sm flex items-center gap-1.5">
                    {syncEnabled ? <><Play className="h-3 w-3" /> Auto-sync is ON</> : <><Pause className="h-3 w-3" /> Auto-sync is PAUSED</>}
                  </span>
                </div>

                {syncEnabled ? (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Poll interval:
                    </label>
                    <select
                      value={pollInterval}
                      onChange={(e) => setPollInterval(Number(e.target.value))}
                      className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={onSaveSyncSettings} disabled={saving}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    {saveDone ? <span className="text-xs text-green-600">Saved</span> : null}
                    {saveError ? <span className="text-xs text-destructive">{saveError}</span> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {props.isOwner
                ? "Connect the shared Gmail account so the CRM can ingest leads and create drafts."
                : "Only the Owner can connect the shared Gmail account."}
            </p>
            {props.isOwner ? (
              <a
                href="/api/gmail/connect"
                className={cn(buttonVariants({ variant: "default" }), "no-underline")}
              >
                Connect Gmail
              </a>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function HealthBanner({ health }: { health?: Props["health"] }) {
  if (!health || !health.errorKind) return null;
  // If the most recent success is newer than the most recent error, the
  // issue has self-resolved and there's nothing actionable to show.
  if (
    health.successAt &&
    health.errorAt &&
    new Date(health.successAt) > new Date(health.errorAt)
  ) {
    return null;
  }

  const presets = {
    auth: {
      title: "Gmail token expired or revoked",
      body: "The CRM can no longer read this inbox. Click Reconnect to re-authorise. Polling will resume immediately after.",
      action: {
        href: "/api/gmail/connect",
        label: "Reconnect",
      },
      severity: "destructive" as const,
    },
    rate_limit: {
      title: "Gmail rate limit hit",
      body: "Google is throttling our requests. We'll retry automatically. If this keeps happening, raise your daily quota in Google Cloud.",
      action: null,
      severity: "warning" as const,
    },
    transient: {
      title: "Last Gmail sync failed",
      body: "A transient error blocked the most recent sync. It will be retried on the next poll.",
      action: null,
      severity: "warning" as const,
    },
  } as const;

  const cfg = presets[health.errorKind];
  const errorAt = health.errorAt ? new Date(health.errorAt) : null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        cfg.severity === "destructive"
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
      )}
    >
      <AlertCircle
        className={cn(
          "h-4 w-4 mt-0.5 shrink-0",
          cfg.severity === "destructive" ? "text-destructive" : "text-amber-600",
        )}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium",
            cfg.severity === "destructive"
              ? "text-destructive"
              : "text-amber-900 dark:text-amber-200",
          )}
        >
          {cfg.title}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {cfg.body}
          {errorAt ? (
            <span className="ml-1">
              · {errorAt.toLocaleString()}
            </span>
          ) : null}
        </p>
        {health.errorMessage ? (
          <p className="text-[11px] text-muted-foreground mt-1 font-mono truncate">
            {health.errorMessage}
          </p>
        ) : null}
      </div>
      {cfg.action ? (
        <a
          href={cfg.action.href}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          {cfg.action.label}
        </a>
      ) : null}
    </div>
  );
}
