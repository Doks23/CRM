"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Save, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SampleRow {
  id: string;
  status: string;
  sku: string | null;
  quantityNote: string | null;
  courier: string | null;
  awb: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  followUpDueAt: string | null;
  note: string | null;
  createdAt: string;
}

interface Props {
  leadId: string;
  initial: SampleRow[];
}

const STATUS_LABELS: Record<string, string> = {
  pending_dispatch: "Pending dispatch",
  in_transit: "In transit",
  delivered: "Delivered",
  follow_up_sent: "Follow-up sent",
  closed: "Closed",
};

/**
 * Compact sample tracker on the thread detail page.
 *
 * Shows the most-recent sample (if any) with edit-in-place for AWB / courier /
 * delivered date. "Add sample" reveals a tiny form. The follow-up cron picks
 * up from `deliveredAt + 3 days` (configurable later) and drafts a check-in.
 */
export function SampleTracker({ leadId, initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SampleRow[]>(initial);
  const [showNew, setShowNew] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newCourier, setNewCourier] = useState("");
  const [newAwb, setNewAwb] = useState("");
  const [newSentToday, setNewSentToday] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addSample() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          sku: newSku.trim() || null,
          courier: newCourier.trim() || null,
          awb: newAwb.trim() || null,
          sentAt: newSentToday ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const row = (await res.json()) as SampleRow;
      setRows([row, ...rows]);
      setShowNew(false);
      setNewSku("");
      setNewCourier("");
      setNewAwb("");
      setNewSentToday(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function patchSample(id: string, patch: Partial<SampleRow>) {
    setError(null);
    try {
      const res = await fetch(`/api/samples/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as SampleRow;
      setRows(rows.map((r) => (r.id === id ? updated : r)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const latest = rows[0];

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span>Sample dispatch</span>
          <span className="text-muted-foreground font-normal">
            — auto follow-up after delivery
          </span>
        </div>
        {!showNew && rows.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowNew(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add another
          </Button>
        ) : null}
      </div>

      {showNew || rows.length === 0 ? (
        <div className="space-y-2 rounded-md border border-dashed p-2.5 bg-background/50">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                SKU
              </label>
              <Input
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="MKH-4S-1KG"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Courier
              </label>
              <Input
                value={newCourier}
                onChange={(e) => setNewCourier(e.target.value)}
                placeholder="Bluedart / DTDC / India Post"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                AWB / tracking
              </label>
              <Input
                value={newAwb}
                onChange={(e) => setNewAwb(e.target.value)}
                placeholder="123456789012"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={newSentToday}
              onChange={(e) => setNewSentToday(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Sent today
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addSample} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {saving ? "Saving…" : "Save sample"}
            </Button>
            {rows.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNew(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            ) : null}
            {error ? (
              <span className="text-[11px] text-destructive">{error}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {latest ? <SampleRowItem row={latest} onPatch={patchSample} /> : null}

      {rows.length > 1 ? (
        <details className="mt-2">
          <summary className="text-[12px] text-muted-foreground cursor-pointer hover:text-foreground">
            {rows.length - 1} earlier sample{rows.length - 1 === 1 ? "" : "s"}
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {rows.slice(1).map((r) => (
              <SampleRowItem key={r.id} row={r} onPatch={patchSample} compact />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SampleRowItem({
  row,
  onPatch,
  compact,
}: {
  row: SampleRow;
  onPatch: (id: string, patch: Partial<SampleRow>) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [awb, setAwb] = useState(row.awb ?? "");
  const [courier, setCourier] = useState(row.courier ?? "");
  const isDelivered = !!row.deliveredAt;
  const followUpDueSoon =
    row.followUpDueAt && new Date(row.followUpDueAt).getTime() < Date.now();

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background/40 px-3 py-2 text-xs",
        compact && "py-1.5",
      )}
    >
      <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="Courier"
              className="h-7 w-32 text-xs"
            />
            <Input
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="AWB"
              className="h-7 w-36 text-xs font-mono"
            />
            <Button
              size="sm"
              onClick={() => {
                onPatch(row.id, {
                  courier: courier.trim() || null,
                  awb: awb.trim() || null,
                });
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {row.sku ? (
              <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded">
                {row.sku}
              </code>
            ) : null}
            <span className="text-foreground">
              {row.courier ?? "no courier"}
              {row.awb ? ` · ${row.awb}` : ""}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] py-0 h-4 capitalize",
                row.status === "delivered" && "border-primary/40 text-primary",
                row.status === "follow_up_sent" && "border-muted text-muted-foreground",
              )}
            >
              {STATUS_LABELS[row.status] ?? row.status}
            </Badge>
            {row.sentAt ? (
              <span className="text-muted-foreground text-[11px]">
                sent {new Date(row.sentAt).toLocaleDateString()}
              </span>
            ) : null}
            {row.deliveredAt ? (
              <span className="text-muted-foreground text-[11px]">
                delivered {new Date(row.deliveredAt).toLocaleDateString()}
              </span>
            ) : null}
            {followUpDueSoon ? (
              <span className="text-amber-600 text-[11px]">
                follow-up due
              </span>
            ) : null}
          </div>
        )}
      </div>
      {!editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {!isDelivered ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onPatch(row.id, { deliveredAt: new Date().toISOString() })
              }
              title="Mark delivered"
            >
              Mark delivered
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            edit
          </button>
        </div>
      ) : null}
    </div>
  );
}
