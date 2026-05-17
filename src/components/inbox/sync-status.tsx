"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.getTime();
  if (!ms) return "never";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SyncStatus({
  email,
  lastPolledAt,
}: {
  email: string | null;
  lastPolledAt: string | Date | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Sync failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [router]);

  if (!email) {
    return (
      <div className="text-[12.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
        not connected
      </div>
    );
  }

  return (
    <div>
      <div className="text-[12.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
        <span className="relative inline-flex size-1.5 rounded-full bg-pos">
          <span className="absolute inset-0 rounded-full bg-pos animate-ping opacity-60" />
        </span>
        {email} · {lastPolledAt ? relativeTime(lastPolledAt) : "never"}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center justify-center size-5 rounded hover:bg-foreground/10 active:bg-foreground/20 disabled:opacity-40 transition-colors"
          title="Sync now"
        >
          <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-destructive mt-0.5">{error}</div>
      )}
    </div>
  );
}
