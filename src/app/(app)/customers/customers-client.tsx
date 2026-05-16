"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Building2, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SmartAvatar } from "@/components/app/smart-avatar";
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

  const handleCreate = async () => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, address, gstin, notes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create customer");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create customer");
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
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {initial.length} customer{initial.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="size-3.5 mr-1" /> Add Customer
        </Button>
      </div>

      <div className="px-6 py-3 border-b border-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Building2 className="size-10 mb-3 opacity-40" />
            <p className="text-[14px] font-medium">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="text-[12px] mt-1">
              {search ? "Try a different search term" : "Add your first customer to get started"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <SmartAvatar name={c.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 px-1 py-px rounded bg-muted">
                        {c.customerCode}
                      </span>
                    </div>
                    {c.company && (
                      <div className="text-[11.5px] text-muted-foreground truncate">{c.company}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-[12px] text-muted-foreground">
                  {c.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="size-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{c.address}</span>
                    </div>
                  )}
                </div>
                {c.gstin && (
                  <div className="text-[10.5px] text-muted-foreground font-mono">
                    GST: {c.gstin}
                  </div>
                )}
                {c.notes && (
                  <p className="text-[11px] text-muted-foreground italic line-clamp-2 border-t border-border pt-2">
                    {c.notes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Add customer</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Name *
              </Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="text-[13px]" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@company.com" className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </Label>
              <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-company" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </Label>
              <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Address
              </Label>
              <textarea
                id="c-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] shadow-sm resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-gstin" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                GSTIN
              </Label>
              <Input id="c-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="GSTIN number" className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </Label>
              <textarea
                id="c-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this customer"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] shadow-sm resize-y"
              />
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={isPending || !name.trim()}>
              {isPending ? "Creating…" : "Create customer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
