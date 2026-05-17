"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

interface Sample {
  id: string;
  sku: string | null;
  quantityNote: string | null;
  status: string | null;
  courier: string | null;
  awb: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  followUpDueAt: string | null;
  note: string | null;
  createdAt: string;
  leadName: string | null;
  leadEmail: string | null;
  leadId: string | null;
}

interface Lead {
  id: string;
  contactName: string | null;
  primaryEmail: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_dispatch", label: "Pending" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "follow_up_sent", label: "Follow-up" },
  { value: "closed", label: "Closed" },
] as const;

function statusStyle(status: string | null) {
  switch (status) {
    case "delivered":
      return "bg-pos-tint text-pos";
    case "in_transit":
      return "bg-info-tint text-info";
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-warning-tint text-warning";
  }
}

export function SamplesList({
  initial,
  leads,
}: {
  initial: Sample[];
  leads: Lead[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [samples, setSamples] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [addForm, setAddForm] = useState({
    leadId: "",
    sku: "",
    quantityNote: "",
    courier: "",
    awb: "",
    sentAt: "",
    note: "",
  });
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return samples.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (s.sku ?? "").toLowerCase().includes(q) ||
        (s.leadName ?? "").toLowerCase().includes(q) ||
        (s.leadEmail ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [samples, search, statusFilter]);

  const refresh = async () => {
    try {
      const res = await fetch("/api/samples");
      if (!res.ok) return;
      const data = await res.json();
      setSamples(data);
    } catch {
      /* ignore */
    }
    router.refresh();
  };

  const handleCreate = async () => {
    if (!addForm.leadId) {
      setError("Please select a lead");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const body: Record<string, string> = { leadId: addForm.leadId };
        if (addForm.sku) body.sku = addForm.sku;
        if (addForm.quantityNote) body.quantityNote = addForm.quantityNote;
        if (addForm.courier) body.courier = addForm.courier;
        if (addForm.awb) body.awb = addForm.awb;
        if (addForm.sentAt) body.sentAt = addForm.sentAt;
        if (addForm.note) body.note = addForm.note;
        const res = await fetch("/api/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed");
        }
        setShowAdd(false);
        setAddForm({
          leadId: "",
          sku: "",
          quantityNote: "",
          courier: "",
          awb: "",
          sentAt: "",
          note: "",
        });
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const openDetail = (s: Sample) => {
    setSelectedSample(s);
    setEditForm({
      sku: s.sku ?? "",
      quantityNote: s.quantityNote ?? "",
      courier: s.courier ?? "",
      awb: s.awb ?? "",
      sentAt: s.sentAt ? new Date(s.sentAt).toISOString().slice(0, 10) : "",
      deliveredAt: s.deliveredAt
        ? new Date(s.deliveredAt).toISOString().slice(0, 10)
        : "",
      status: s.status ?? "",
      note: s.note ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!selectedSample) return;
    setError(null);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(editForm)) {
          if (key === "status" || key === "note") {
            body[key] = val || null;
          } else {
            body[key] = val || null;
          }
        }
        const res = await fetch(`/api/samples/${selectedSample.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed");
        }
        setSelectedSample(null);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] serif leading-tight">Samples</h1>
          <p className="text-[14px] text-muted-foreground mt-0.5">
            {samples.length} sample{samples.length !== 1 ? "s" : ""} dispatched
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Sample
        </Button>
      </div>

      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by SKU or lead…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? "default" : "outline"}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-[15px] font-medium">
              {search || statusFilter !== "all"
                ? "No matching samples"
                : "No samples dispatched yet"}
            </p>
            <p className="text-[13px] mt-1">
              {search || statusFilter !== "all"
                ? "Try a different search or filter."
                : "Click Add Sample to create one."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openDetail(s)}
                className="w-full text-left rounded-lg border px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-medium">{s.sku ?? "—"}</span>
                    <span
                      className={`text-[11px] px-1.5 py-px rounded-full font-medium capitalize ${statusStyle(s.status)}`}
                    >
                      {s.status?.replace(/_/g, " ") ?? "pending"}
                    </span>
                  </div>
                  {s.leadName && (
                    <Link
                      href={`/inbox/${s.leadId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[13px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {s.leadName}
                      {s.leadEmail ? ` · ${s.leadEmail}` : ""}
                    </Link>
                  )}
                  <div className="text-[12px] text-muted-foreground mt-1 flex gap-3 flex-wrap">
                    {s.quantityNote && <span>Qty: {s.quantityNote}</span>}
                    {s.courier && (
                      <span>
                        {s.courier}
                        {s.awb ? `: ${s.awb}` : ""}
                      </span>
                    )}
                    {s.sentAt && (
                      <span>Sent {new Date(s.sentAt).toLocaleDateString()}</span>
                    )}
                    {s.deliveredAt && (
                      <span>
                        Delivered {new Date(s.deliveredAt).toLocaleDateString()}
                      </span>
                    )}
                    {s.followUpDueAt && (
                      <span>
                        Follow-up due{" "}
                        {new Date(s.followUpDueAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="px-6 py-2 border-t border-border">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Add Sample</SheetTitle>
            <SheetDescription>
              Create a new sample dispatch for a lead.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-3">
            <div className="space-y-1">
              <Label>Lead *</Label>
              <select
                value={addForm.leadId}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, leadId: e.target.value }))
                }
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Select a lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.contactName ?? "—"} ({l.primaryEmail})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input
                placeholder="e.g. COT-001"
                value={addForm.sku}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, sku: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Quantity note</Label>
              <Input
                placeholder="e.g. 2 kg"
                value={addForm.quantityNote}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, quantityNote: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Courier</Label>
              <Input
                placeholder="e.g. Delhivery, DTDC"
                value={addForm.courier}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, courier: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>AWB / tracking</Label>
              <Input
                placeholder="Tracking number"
                value={addForm.awb}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, awb: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Sent date</Label>
              <Input
                type="date"
                value={addForm.sentAt}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, sentAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input
                placeholder="Internal note"
                value={addForm.note}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="ghost">Cancel</Button>} />
            <Button onClick={handleCreate} disabled={isPending}>
              Create
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!selectedSample}
        onOpenChange={(open) => {
          if (!open) setSelectedSample(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {selectedSample?.sku ?? "Sample"} —{" "}
              {selectedSample?.leadName ?? "Unknown"}
            </SheetTitle>
            <SheetDescription>
              Update sample dispatch details.
            </SheetDescription>
          </SheetHeader>
          {selectedSample && (
            <div className="flex-1 overflow-y-auto px-4 space-y-3">
              <div className="flex gap-2 items-center">
                <span
                  className={`text-[11px] px-1.5 py-px rounded-full font-medium capitalize ${statusStyle(editForm.status)}`}
                >
                  {editForm.status?.replace(/_/g, " ") ?? "pending"}
                </span>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {STATUS_OPTIONS.filter((o) => o.value !== "all").map(
                    (opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input
                  value={editForm.sku}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, sku: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Quantity note</Label>
                <Input
                  value={editForm.quantityNote}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, quantityNote: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Courier</Label>
                <Input
                  value={editForm.courier}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, courier: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>AWB / tracking</Label>
                <Input
                  value={editForm.awb}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, awb: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Sent date</Label>
                  <Input
                    type="date"
                    value={editForm.sentAt ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, sentAt: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Delivered date</Label>
                  <Input
                    type="date"
                    value={editForm.deliveredAt ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        deliveredAt: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Note</Label>
                <Input
                  value={editForm.note}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
          <SheetFooter>
            <SheetClose render={<Button variant="ghost">Cancel</Button>} />
            <Button onClick={handleUpdate} disabled={isPending}>
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
