"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

const STAGES = [
  { value: "new", label: "New" },
  { value: "ignored", label: "Ignored" },
  { value: "info_sent", label: "Info Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "po", label: "PO" },
  { value: "dispatched", label: "Dispatched" },
];

export function StageSelect({
  leadId,
  currentStage,
}: {
  leadId: string;
  currentStage: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/leads/stage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, stage: newStage }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update stage");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setSaving(false);
    }
  };

  const style = stageTextStyle(currentStage);

  return (
    <div className="relative group">
      <select
        value={currentStage ?? "new"}
        onChange={handleChange}
        disabled={saving}
        title={error ?? undefined}
        className={`text-[12px] py-0 h-5 px-1.5 capitalize border rounded-md appearance-none cursor-pointer bg-transparent hover:bg-foreground/5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${error ? "border-destructive/50" : ""} ${style}`}
        style={{ paddingRight: "18px" }}
      >
        {STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
        ▾
      </span>
      {saving && (
        <span className="absolute -right-4 top-1/2 -translate-y-1/2">
          <span className="size-2 rounded-full bg-primary animate-pulse" />
        </span>
      )}
      {error && (
        <div className="absolute top-full left-0 mt-1 z-10 flex items-center gap-1 text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded px-1.5 py-0.5 whitespace-nowrap">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="max-w-[200px] truncate">{error}</span>
        </div>
      )}
    </div>
  );
}

function stageTextStyle(stage: string | null): string {
  switch (stage) {
    case "dispatched":
      return "bg-info/10 text-info border-info/25";
    case "po":
    case "info_sent":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "ignored":
      return "bg-muted text-muted-foreground border-foreground/15";
    default:
      return "bg-muted text-foreground/80 border-foreground/15";
  }
}
