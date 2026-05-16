"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FestiveDateRow {
  date: string; // "MM-DD"
  label: string;
}

interface Props {
  initial: FestiveDateRow[];
}

const SUGGESTIONS: FestiveDateRow[] = [
  { date: "01-01", label: "New Year" },
  { date: "01-14", label: "Makar Sankranti" },
  { date: "03-25", label: "Holi" },
  { date: "08-15", label: "Independence Day" },
  { date: "08-19", label: "Raksha Bandhan" },
  { date: "10-02", label: "Gandhi Jayanti" },
  { date: "10-21", label: "Dussehra" },
  { date: "11-01", label: "Diwali" },
  { date: "12-25", label: "Christmas" },
];

/**
 * Edits businessProfile.festiveDates — the calendar dates the seasonal-outreach
 * cron uses to draft greeting messages.
 *
 * Each row is a year-agnostic MM-DD plus a label that ends up in the greeting
 * prompt ("Diwali", "New Year", etc.). The cron fires each morning and
 * checks today's MM-DD against this list.
 */
export function FestiveDatesEditor({ initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<FestiveDateRow[]>(initial ?? []);
  const [draftDate, setDraftDate] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addRow() {
    if (!/^\d{2}-\d{2}$/.test(draftDate)) {
      setError("Date must be MM-DD, e.g. 11-01");
      return;
    }
    if (!draftLabel.trim()) {
      setError("Label is required");
      return;
    }
    if (rows.some((r) => r.date === draftDate)) {
      setError("That date is already in the list");
      return;
    }
    setRows([...rows, { date: draftDate, label: draftLabel.trim() }]);
    setDraftDate("");
    setDraftLabel("");
    setError(null);
  }

  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  function addSuggestion(s: FestiveDateRow) {
    if (rows.some((r) => r.date === s.date)) return;
    setRows([...rows, s]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festiveDates: sorted }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setRows(sorted);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const remaining = SUGGESTIONS.filter(
    (s) => !rows.some((r) => r.date === s.date),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <CalendarHeart className="h-4 w-4 text-primary" />
        <span className="font-medium">Festive dates</span>
        <span className="text-muted-foreground">
          — auto-draft greetings for these days
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No dates configured. Add common Indian B2B occasions below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div
              key={`${row.date}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-card/40 px-3 py-1.5 text-sm"
            >
              <code className="text-xs font-mono text-muted-foreground w-12">
                {row.date}
              </code>
              <span className="flex-1 truncate">{row.label}</span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Date (MM-DD)
          </label>
          <Input
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            placeholder="11-01"
            className="h-8 w-24 font-mono text-xs"
          />
        </div>
        <div className="space-y-1 flex-1">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Label
          </label>
          <Input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Diwali"
            className="h-8 text-sm"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {remaining.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Quick-add
          </p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((s) => (
              <button
                key={s.date}
                type="button"
                onClick={() => addSuggestion(s)}
                className="text-[12px] rounded-md border border-dashed px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                + {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "Saving…" : "Save festive dates"}
        </Button>
        {saved ? (
          <span className="text-xs text-primary">Saved</span>
        ) : error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </div>
  );
}
