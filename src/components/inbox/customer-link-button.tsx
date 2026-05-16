"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomerInfo {
  id: string;
  customerCode: string;
  name: string;
}

interface LeadContact {
  contactName: string | null;
  primaryEmail: string | null;
  company: string | null;
  phone: string | null;
}

interface Props {
  leadId: string;
  leadContact: LeadContact;
  customer: CustomerInfo | null;
}

export function CustomerLinkButton({ leadId, leadContact, customer }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (customer) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[12px] font-mono font-semibold text-foreground/70">{customer.customerCode}</span>
        <span className="text-foreground/85">{customer.name}</span>
        <button
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Edit customer"
        >
          <Pencil className="size-3" />
        </button>
        <CustomerEditDialog
          leadId={leadId}
          leadContact={leadContact}
          customer={customer}
          open={open}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh(); }}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[12px] text-muted-foreground">No customer</span>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        title="Link or create customer"
      >
        <Plus className="size-3" /> Link
      </button>
      <CustomerCreateDialog
        leadId={leadId}
        leadContact={leadContact}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); router.refresh(); }}
      />
    </span>
  );
}

interface EditDialogProps {
  leadId: string;
  leadContact: LeadContact;
  customer: CustomerInfo & { email?: string | null; phone?: string | null; company?: string | null };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function CustomerEditDialog({ leadId, leadContact, customer, open, onClose, onSaved }: EditDialogProps) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!open) return null;

  async function loadCustomer() {
    if (loaded) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setName(data.name ?? customer.name);
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setCompany(data.company ?? "");
      }
    } catch {}
    setLoaded(true);
  }

  loadCustomer();

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email || null, phone: phone || null, company: company || null }),
      });
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[380px] rounded-xl border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold">
            {customer.customerCode} — {customer.name}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] font-medium text-muted-foreground">Customer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-[14px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-[14px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px] font-medium text-muted-foreground">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-[14px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px] font-medium text-muted-foreground">Company</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="text-[14px] mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}

interface CreateDialogProps {
  leadId: string;
  leadContact: LeadContact;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function CustomerCreateDialog({ leadId, leadContact, open, onClose, onSaved }: CreateDialogProps) {
  const [mode, setMode] = useState<"create" | "search">("create");
  const [name, setName] = useState(leadContact.contactName ?? "");
  const [email, setEmail] = useState(leadContact.primaryEmail ?? "");
  const [phone, setPhone] = useState(leadContact.phone ?? "");
  const [company, setCompany] = useState(leadContact.company ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; customerCode: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  if (!open) return null;

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const all: Array<{ id: string; customerCode: string; name: string; email: string; company: string }> = await res.json();
        const ql = q.toLowerCase();
        setSearchResults(
          all.filter((c) => c.name.toLowerCase().includes(ql) || c.customerCode.toLowerCase().includes(ql) || c.email?.toLowerCase().includes(ql))
            .slice(0, 10)
        );
      }
    } catch {} finally {
      setSearching(false);
    }
  }

  async function linkCustomer(customerId: string) {
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function createAndLink() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email || null,
          phone: phone || null,
          company: company || null,
        }),
      });
      if (!res.ok) return;
      const created = await res.json();
      await fetch(`/api/leads/${leadId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: created.id }),
      });
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl border bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold">Link customer</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 h-7 text-[12.5px] font-medium rounded-md ${mode === "create" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}
          >
            New customer
          </button>
          <button
            onClick={() => setMode("search")}
            className={`flex-1 h-7 text-[12.5px] font-medium rounded-md ${mode === "search" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}
          >
            Search existing
          </button>
        </div>

        {mode === "search" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => doSearch(e.target.value)}
                placeholder="Search by name, code, or email…"
                className="text-[13px] pl-8"
                autoFocus
              />
            </div>
            {searching && <p className="text-[12px] text-muted-foreground">Searching…</p>}
            {searchResults.length > 0 ? (
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => linkCustomer(c.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-foreground/5 transition-colors"
                  >
                    <span className="text-[12px] font-mono font-semibold text-muted-foreground">{c.customerCode}</span>
                    <span className="text-[13px] font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() && !searching ? (
              <p className="text-[12px] text-muted-foreground">No customers found. Switch to &quot;New customer&quot; to create one.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Customer name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="text-[14px] mt-1" autoFocus />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <Button className="w-full mt-2" size="sm" onClick={createAndLink} disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create & link"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Code will be auto-generated (CUST-XXXX)
            </p>
          </div>
        )}
      </div>
    </>
  );
}
