"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  grade: string | null;
  packSize: string | null;
  moq: number | null;
  priceRetail: string | null;
  priceWholesale: string | null;
  stockNote: string | null;
  active: boolean;
}

export function ProductList({ initial }: { initial: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: "", name: "", grade: "", packSize: "", moq: "", priceRetail: "", priceWholesale: "", stockNote: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => { fetch("/api/products").then(r => r.json()).then(setProducts); router.refresh(); };

  const handleSave = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const isEdit = !!editingId;
        const url = isEdit ? `/api/products/${editingId}` : "/api/products";
        const method = isEdit ? "PATCH" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        setShowForm(false); setEditingId(null); setForm({ sku: "", name: "", grade: "", packSize: "", moq: "", priceRetail: "", priceWholesale: "", stockNote: "" });
        refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      refresh();
    });
  };

  const edit = (p: Product) => {
    setEditingId(p.id); setShowForm(true);
    setForm({ sku: p.sku, name: p.name, grade: p.grade ?? "", packSize: p.packSize ?? "", moq: p.moq?.toString() ?? "", priceRetail: p.priceRetail ?? "", priceWholesale: p.priceWholesale ?? "", stockNote: p.stockNote ?? "" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); setForm({ sku: "", name: "", grade: "", packSize: "", moq: "", priceRetail: "", priceWholesale: "", stockNote: "" }); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Input placeholder="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Grade" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} />
            <Input placeholder="Pack size" value={form.packSize} onChange={e => setForm(f => ({ ...f, packSize: e.target.value }))} />
            <Input placeholder="MOQ" type="number" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))} />
            <Input placeholder="Retail price INR" value={form.priceRetail} onChange={e => setForm(f => ({ ...f, priceRetail: e.target.value }))} />
            <Input placeholder="Wholesale price INR" value={form.priceWholesale} onChange={e => setForm(f => ({ ...f, priceWholesale: e.target.value }))} />
            <Input placeholder="Stock note" value={form.stockNote} onChange={e => setForm(f => ({ ...f, stockNote: e.target.value }))} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}><Check className="h-3.5 w-3.5 mr-1" /> {editingId ? "Update" : "Add"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {products.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground w-20">{p.sku}</span>
            <span className="flex-1 font-medium">{p.name}</span>
            {p.grade && <span className="text-xs text-muted-foreground">{p.grade}</span>}
            {p.priceWholesale && <span className="text-xs">₹{p.priceWholesale}</span>}
            {!p.active && <span className="text-[10px] text-muted-foreground border rounded px-1">inactive</span>}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => edit(p)}><Pencil className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
