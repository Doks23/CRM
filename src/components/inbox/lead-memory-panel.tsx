"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  initialNotes: string | null;
}

/**
 * Per-lead memory panel.
 *
 * Sits above the thread message list. The text inside this box is fed into
 * every AI draft for this lead — the single highest-leverage way to make
 * replies feel personal.
 *
 * Saves on blur (debounced) so users can write freely without thinking
 * about a save button. Visually quiet when empty, clearly editable when
 * focused.
 */
export function LeadMemoryPanel({ leadId, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const savedTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSaved = useRef(initialNotes ?? "");

  // Clear pending timers on unmount.
  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  async function save() {
    const next = value.trim();
    if (next === lastSaved.current.trim()) return;

    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesForAi: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      lastSaved.current = next;
      setStatus("saved");
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>What we know about this lead</span>
          <span className="text-muted-foreground font-normal">
            — used by AI on every draft
          </span>
        </div>
        <SaveStatus status={status} errorMessage={errorMessage} />
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={3}
        placeholder={
          "Region, payment terms, preferred SKU, last order, anything else worth remembering.\n" +
          'e.g. "Distributor in Lucknow. Prefers 4-suta. Pays 50% advance. Calls after 6 PM."'
        }
        className={cn(
          "w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      />
    </div>
  );
}

function SaveStatus({
  status,
  errorMessage,
}: {
  status: "idle" | "saving" | "saved" | "error";
  errorMessage: string | null;
}) {
  if (status === "saving") {
    return (
      <span className="text-[11px] text-muted-foreground">Saving…</span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-[11px] text-primary flex items-center gap-1">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="text-[11px] text-destructive flex items-center gap-1"
        title={errorMessage ?? undefined}
      >
        <AlertCircle className="h-3 w-3" /> Couldn’t save
      </span>
    );
  }
  return null;
}
