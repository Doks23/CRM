"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Plus, Minus, History, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  productId: string;
  quantity: number;
  sku: string;
  productName: string;
  grade: string | null;
  packSize: string | null;
  moq: number | null;
  priceRetail: string | null;
  priceWholesale: string | null;
  stockNote: string | null;
  movementCount: number;
}

export function InventoryClient({ items: initial }: { items: InventoryItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [movementForm, setMovementForm] = useState<Record<string, { quantity: string; type: string; note: string }>>({});
  const [history, setHistory] = useState<Record<string, { show: boolean; rows: { id: string; quantity: number; type: string; note: string | null; createdAt: string }[] }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  const [success, setSuccess] = useState<Record<string, string | null>>({});

  async function recordMovement(item: InventoryItem) {
    const form = movementForm[item.id];
    if (!form?.quantity) return;

    setLoading(l => ({ ...l, [item.id]: true }));
    setError(e => ({ ...e, [item.id]: null }));
    setSuccess(s => ({ ...s, [item.id]: null }));

    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId: item.id,
          productId: item.productId,
          quantity: Number(form.quantity),
          type: form.type,
          note: form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMovementForm(f => ({ ...f, [item.id]: { quantity: "", type: "production", note: "" } }));
      setSuccess(s => ({ ...s, [item.id]: "Done!" }));
      setTimeout(() => setSuccess(s => ({ ...s, [item.id]: null })), 2000);
      router.refresh();
    } catch (err) {
      setError(e => ({ ...e, [item.id]: err instanceof Error ? err.message : "Error" }));
    } finally {
      setLoading(l => ({ ...l, [item.id]: false }));
    }
  }

  async function toggleHistory(itemId: string) {
    const current = history[itemId]?.show ?? false;
    if (!current) {
      const res = await fetch(`/api/inventory/movements?inventoryId=${itemId}`);
      const rows = await res.json();
      setHistory(h => ({ ...h, [itemId]: { show: true, rows } }));
    } else {
      setHistory(h => ({ ...h, [itemId]: { ...h[itemId], show: false } }));
    }
  }

  return (
    <div className="p-8 max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stock levels and movement log for all products.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const form = movementForm[item.id] ?? { quantity: "", type: "production", note: "" };
          const isLow = item.moq && item.quantity < item.moq;
          return (
            <div key={item.id} className="rounded-lg border bg-card">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      {item.productName}
                      <Badge variant="outline" className="text-[11px] py-0 h-4 font-mono">
                        {item.sku}
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[item.grade, item.packSize].filter(Boolean).join(" · ")}
                      {item.moq ? ` · MOQ: ${item.moq}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums">
                        {item.quantity}
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                        In stock
                      </div>
                    </div>
                    {isLow ? (
                      <Badge variant="destructive" className="text-[11px] py-0 h-5">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low stock
                      </Badge>
                    ) : item.quantity === 0 ? (
                      <Badge variant="secondary" className="text-[11px] py-0 h-5">
                        Out of stock
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {item.priceRetail ? (
                  <div className="text-xs text-muted-foreground mb-3">
                    Retail: ₹{item.priceRetail} · Wholesale: ₹{item.priceWholesale ?? "—"}
                    {item.stockNote ? ` · ${item.stockNote}` : ""}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setMovementForm(f => ({
                        ...f,
                        [item.id]: { ...(f[item.id] ?? form), type: e.target.value },
                      }))
                    }
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="production">Production (in)</option>
                    <option value="shipment">Shipment (out)</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="return">Return (in)</option>
                    <option value="damage">Damage (out)</option>
                  </select>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={form.quantity}
                      onChange={(e) =>
                        setMovementForm(f => ({
                          ...f,
                          [item.id]: { ...(f[item.id] ?? form), quantity: e.target.value },
                        }))
                      }
                      className="h-8 w-20"
                    />
                  </div>
                  <Input
                    placeholder="Note (optional)"
                    value={form.note}
                    onChange={(e) =>
                      setMovementForm(f => ({
                        ...f,
                        [item.id]: { ...(f[item.id] ?? form), note: e.target.value },
                      }))
                    }
                    className="h-8 w-48"
                  />
                  <Button
                    size="sm"
                    variant={form.type === "production" || form.type === "return" ? "default" : "secondary"}
                    onClick={() => recordMovement(item)}
                    disabled={loading[item.id] || !form.quantity}
                  >
                    {loading[item.id] ? "..." : form.type === "production" || form.type === "return" ? (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
                    ) : (
                      <><Minus className="h-3.5 w-3.5 mr-1" /> Remove</>
                    )}
                  </Button>
                  {success[item.id] ? (
                    <span className="text-xs text-green-600">{success[item.id]}</span>
                  ) : null}
                  {error[item.id] ? (
                    <span className="text-xs text-destructive">{error[item.id]}</span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => toggleHistory(item.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-3 w-3" />
                  {item.movementCount} movement{item.movementCount !== 1 ? "s" : ""}
                  {history[item.id]?.show ? " (hide)" : ""}
                </button>
              </div>

              {history[item.id]?.show ? (
                <div className="border-t px-5 py-3 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1 font-medium">Type</th>
                        <th className="text-right py-1 font-medium">Qty</th>
                        <th className="text-left py-1 font-medium pl-2">Note</th>
                        <th className="text-right py-1 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history[item.id].rows.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-1.5 capitalize">{m.type}</td>
                          <td className={`py-1.5 text-right font-mono tabular-nums ${m.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-1.5 pl-2 text-muted-foreground max-w-48 truncate">
                            {m.note ?? "—"}
                          </td>
                          <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
