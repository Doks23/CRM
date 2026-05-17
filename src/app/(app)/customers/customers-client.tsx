"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

interface Customer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  createdAt: Date;
}

export function CustomersClient({
  customers: initial,
}: {
  customers: Customer[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAddress("");
    setGstin("");
    setNotes("");
    setError(null);
  };

  const openCreate = () => {
    reset();
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setCompany(c.company ?? "");
    setAddress(c.address ?? "");
    setGstin(c.gstin ?? "");
    setNotes(c.notes ?? "");
    setEditing(c);
    setOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsPending(true);
    try {
      const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, address, gstin, notes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save customer");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save customer");
    } finally {
      setIsPending(false);
    }
  };

  const filtered = search.trim()
    ? initial.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
          (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
          c.customerCode.toLowerCase().includes(search.toLowerCase()),
      )
    : initial;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-[26px] serif leading-tight">Customers</h1>
          <p className="text-[14px] text-muted-foreground mt-0.5">
            {initial.length} customer{initial.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-[14px]"
            />
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="size-3.5 mr-1" /> Add Customer
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-[15px] font-medium">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
          </div>
        ) : (
          /// Scrollable table wrapper for mobile
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="text-left px-4 lg:px-6 py-3 font-medium">Code</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium hidden sm:table-cell">Company</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium hidden lg:table-cell">GSTIN</th>
                  <th className="text-left px-3 lg:px-4 py-3 font-medium hidden lg:table-cell">Address</th>
                  <th className="w-12 px-3 lg:px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-foreground/[0.02]">
                    <td className="px-4 lg:px-6 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">{c.customerCode}</td>
                    <td className="px-3 lg:px-4 py-3 font-medium whitespace-nowrap">{c.name}</td>
                    <td className="px-3 lg:px-4 py-3 text-muted-foreground whitespace-nowrap hidden sm:table-cell">{c.company ?? "-"}</td>
                    <td className="px-3 lg:px-4 py-3 text-muted-foreground whitespace-nowrap hidden md:table-cell">{c.email ?? "-"}</td>
                    <td className="px-3 lg:px-4 py-3 text-muted-foreground whitespace-nowrap hidden md:table-cell">{c.phone ?? "-"}</td>
                    <td className="px-3 lg:px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-[12px] hidden lg:table-cell">{c.gstin ?? "-"}</td>
                    <td className="px-3 lg:px-4 py-3 text-muted-foreground truncate max-w-[200px] hidden lg:table-cell">{c.address ?? "-"}</td>
                    <td className="px-3 lg:px-4 py-3">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit customer" : "Add customer"}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Name *
              </Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="text-[14px]" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@company.com" className="text-[14px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </Label>
              <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="text-[14px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-company" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </Label>
              <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="text-[14px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Address
              </Label>
              <textarea
                id="c-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] shadow-sm resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-gstin" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                GSTIN
              </Label>
              <Input id="c-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="GSTIN number" className="text-[14px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </Label>
              <textarea
                id="c-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this customer"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] shadow-sm resize-y"
              />
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending || !name.trim()}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Create customer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
