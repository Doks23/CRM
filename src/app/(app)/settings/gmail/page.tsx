import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/db";
import { GmailConnectionCard } from "@/components/app/gmail-connection-card";
import { getBusinessProfile } from "@/lib/business-profile";

export const dynamic = "force-dynamic";

export default async function SettingsGmailPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const session = await auth();
  const isOwner = session?.user.role === "owner";
  const params = await searchParams;

  const [account, profile] = await Promise.all([
    db.query.gmailAccount.findFirst(),
    getBusinessProfile(),
  ]);

  const banner = params.gmail_connected
    ? {
        kind: "ok" as const,
        text: "Gmail account connected. Backfill is in progress.",
      }
    : params.gmail_error
      ? { kind: "error" as const, text: gmailErrorMessage(params.gmail_error) }
      : null;

  return (
    <div className="space-y-4">
      <header>
        <h1>Gmail connection</h1>
        <p className="text-meta">
          The shared inbox the CRM reads from and drafts back into.
        </p>
      </header>

      <GmailConnectionCard
        status={account ? "connected" : "disconnected"}
        email={account?.email}
        lastPolledAt={account?.lastPolledAt?.toISOString() ?? null}
        lastHistoryId={account?.lastHistoryId ?? null}
        messageCount={0}
        inboundCount={0}
        outboundCount={0}
        banner={banner}
        isOwner={!!isOwner}
        gmailSyncEnabled={profile?.gmailSyncEnabled ?? true}
        pollIntervalMinutes={profile?.pollIntervalMinutes ?? 2}
        health={
          account
            ? {
                errorKind: (account.lastErrorKind ?? null) as
                  | "auth"
                  | "rate_limit"
                  | "transient"
                  | null,
                errorMessage: account.lastErrorMessage ?? null,
                errorAt: account.lastErrorAt?.toISOString() ?? null,
                successAt: account.lastSuccessAt?.toISOString() ?? null,
              }
            : undefined
        }
      />

      {/* Owner-only hint to wire alternate accounts */}
      {isOwner && !account ? (
        <div className="rounded-md border border-info/30 bg-info/[0.05] px-3 py-2.5 flex items-start gap-2 text-[12px]">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-info shrink-0" />
          <p className="text-foreground/80">
            Heads up: until you reconnect, AI drafts and the Inbox will be empty.
            See <Link href="/reports" className="underline">Reports</Link> to
            track AI activity after you connect.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function gmailErrorMessage(code: string): string {
  switch (code) {
    case "forbidden":
      return "Only the Owner can connect Gmail.";
    case "state_mismatch":
      return "OAuth state mismatch. Please retry from Settings.";
    case "missing_code":
      return "No authorization code returned by Google.";
    case "access_denied":
      return "Consent was declined.";
    default:
      return `Gmail connection failed: ${decodeURIComponent(code)}`;
  }
}
