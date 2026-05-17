"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReSyncButton() {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/gmail/sync", { method: "POST" });
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing…" : "Re-sync"}
    </Button>
  );
}
