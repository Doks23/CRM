"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Plus, Search, Unlink, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FullCustomer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  customer: { id: string; customerCode: string; name: string } | null;
  compact?: boolean;
}

export function CustomerLinkButton({ leadId, leadContact, customer, compact = false }: Props) {
  const router = useRouter();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  if (compact) {
    return (
      <span className="inline-flex items-center">
        {customer ? (
          <>
            <button
              onClick={() => setShowLinkDialog(true)}
              className="h-6 w-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              title={`Linked to ${customer.customerCode}: ${customer.name}`}
            >
              <Users className="size-3.5" />
            </button>
            {showLinkDialog && (
              <CustomerLinkDialog
                leadId={leadId}
                leadContact={leadContact}
                currentCustomerId={customer.id}
                open={showLinkDialog}
                onClose={() => setShowLinkDialog(false)}
                onChanged={() => { setShowLinkDialog(false); router.refresh(); }}
              />
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setShowLinkDialog(true)}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              title="Link to customer"
            >
              <Plus className="size-3.5" />
            </button>
            {showLinkDialog && (
              <CustomerLinkDialog
                leadId={leadId}
                leadContact={leadContact}
                currentCustomerId={null}
                open={showLinkDialog}
                onClose={() => setShowLinkDialog(false)}
                onChanged={() => { setShowLinkDialog(false); router.refresh(); }}
              />
            )}
          </>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {customer ? (
        <>
          <span className="text-[12px] font-mono font-semibold text-foreground/70">{customer.customerCode}</span>
          <span className="text-foreground/85">{customer.name}</span>
          <button
            onClick={() => setShowEditDialog(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Edit customer details"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={() => setShowLinkDialog(true)}
            className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            title="Change or unlink customer"
          >
            <Search className="size-2.5" /> Change
          </button>
          {showEditDialog && (
            <CustomerEditDialog
              customerId={customer.id}
              customer={customer}
              open={showEditDialog}
              onClose={() => setShowEditDialog(false)}
              onSaved={() => { setShowEditDialog(false); router.refresh(); }}
            />
          )}
          {showLinkDialog && (
            <CustomerLinkDialog
              leadId={leadId}
              leadContact={leadContact}
              currentCustomerId={customer.id}
              open={showLinkDialog}
              onClose={() => setShowLinkDialog(false)}
              onChanged={() => { setShowLinkDialog(false); router.refresh(); }}
            />
          )}
        </>
      ) : (
        <>
          <span className="text-[12px] text-muted-foreground">No customer</span>
          <button
            onClick={() => setShowLinkDialog(true)}
            className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Link or create customer"
          >
            <Plus className="size-3" /> Link
          </button>
          {showLinkDialog && (
            <CustomerLinkDialog
              leadId={leadId}
              leadContact={leadContact}
              currentCustomerId={null}
              open={showLinkDialog}
              onClose={() => setShowLinkDialog(false)}
              onChanged={() => { setShowLinkDialog(false); router.refresh(); }}
            />
          )}
        </>
      )}
    </span>
  );
}

interface LinkDialogProps {
  leadId: string;
  leadContact: LeadContact;
  currentCustomerId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function CustomerLinkDialog({ leadId, leadContact, currentCustomerId, open, onClose, onChanged }: LinkDialogProps) {
  const [mode, setMode] = useState<"create" | "search">("search");
  const [name, setName] = useState(leadContact.contactName ?? "");
  const [email, setEmail] = useState(leadContact.primaryEmail ?? "");
  const [phone, setPhone] = useState(leadContact.phone ?? "");
  const [company, setCompany] = useState(leadContact.company ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<FullCustomer>>([]);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(currentCustomerId ? "search" : "search");
      setName(leadContact.contactName ?? "");
      setEmail(leadContact.primaryEmail ?? "");
      setPhone(leadContact.phone ?? "");
      setCompany(leadContact.company ?? "");
      setSearchQuery("");
      setSearchResults([]);
      setSaving(false);
    }
  }, [open, currentCustomerId, leadContact]);

  if (!open) return null;

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const all: FullCustomer[] = await res.json();
        const ql = q.toLowerCase();
        setSearchResults(
          all.filter((c) =>
            c.id !== currentCustomerId &&
            (c.name.toLowerCase().includes(ql) || c.customerCode.toLowerCase().includes(ql) || (c.email && c.email.toLowerCase().includes(ql)))
          )
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
      onChanged();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function doUnlink() {
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: null }),
      });
      onChanged();
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
      onChanged();
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl border bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold">
            {currentCustomerId ? "Change customer" : "Link customer"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {currentCustomerId && (
          <button
            onClick={doUnlink}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 mb-3 py-2 px-3 rounded-lg text-sm text-destructive hover:bg-destructive/5 border border-destructive/20 transition-colors disabled:opacity-50"
          >
            <Unlink className="size-3.5" />
            Unlink current customer
          </button>
        )}

        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setMode("search")}
            className={`flex-1 h-7 text-[12.5px] font-medium rounded-md ${mode === "search" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}
          >
            Search existing
          </button>
          <button
            onClick={() => setMode("create")}
            className={`flex-1 h-7 text-[12.5px] font-medium rounded-md ${mode === "create" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}
          >
            New customer
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
                    disabled={saving}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-foreground/5 transition-colors disabled:opacity-50"
                  >
                    <span className="text-[12px] font-mono font-semibold text-muted-foreground">{c.customerCode}</span>
                    <span className="text-[13px] font-medium">{c.name}</span>
                    {c.email && <span className="text-[12px] text-muted-foreground ml-auto">{c.email}</span>}
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-[14px] mt-1" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-muted-foreground">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-[14px] mt-1" />
              </div>
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

interface EditDialogProps {
  customerId: string;
  customer: { id: string; customerCode: string; name: string };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function CustomerEditDialog({ customerId, customer, open, onClose, onSaved }: EditDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [notes, setNotes] = useState("");
  const [original, setOriginal] = useState<FullCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }

    setLoading(true);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAddress("");
    setGstin("");
    setNotes("");
    setOriginal(null);
    setConfirming(false);

    async function load() {
      try {
        const res = await fetch(`/api/customers/${customerId}`);
        if (res.ok) {
          const data: FullCustomer = await res.json();
          setName(data.name ?? customer.name);
          setEmail(data.email ?? "");
          setPhone(data.phone ?? "");
          setCompany(data.company ?? "");
          setAddress(data.address ?? "");
          setGstin(data.gstin ?? "");
          setNotes(data.notes ?? "");
          setOriginal(data);
        }
      } catch {
        setName(customer.name);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, customerId, customer.name]);

  if (!open) return null;

  function getChanges() {
    if (!original) return [];
    const changes: string[] = [];
    if (name.trim() !== original.name) changes.push(`Name: "${original.name}" → "${name.trim()}"`);
    if ((email || "") !== (original.email || "")) changes.push(`Email: ${original.email || "(empty)"} → ${email || "(empty)"}`);
    if ((phone || "") !== (original.phone || "")) changes.push(`Phone: ${original.phone || "(empty)"} → ${phone || "(empty)"}`);
    if ((company || "") !== (original.company || "")) changes.push(`Company: ${original.company || "(empty)"} → ${company || "(empty)"}`);
    if ((address || "") !== (original.address || "")) changes.push(`Address: ${original.address ? "(has value)" : "(empty)"} → ${address ? "(has value)" : "(empty)"}`);
    if ((gstin || "") !== (original.gstin || "")) changes.push(`GSTIN: ${original.gstin || "(empty)"} → ${gstin || "(empty)"}`);
    if ((notes || "") !== (original.notes || "")) changes.push(`Notes: ${original.notes ? "(has value)" : "(empty)"} → ${notes ? "(has value)" : "(empty)"}`);
    return changes;
  }

  async function doSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email || null,
          phone: phone || null,
          company: company || null,
          address: address || null,
          gstin: gstin || null,
          notes: notes || null,
        }),
      });
      onSaved();
    } catch {} finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const changes = getChanges();

  if (confirming && changes.length > 0) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setConfirming(false)} />
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl border bg-card p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Confirm changes</h3>
            <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-[13px] text-muted-foreground mb-3">About to update <span className="font-medium text-foreground">{customer.customerCode}</span> with these changes:</p>
            <div className="space-y-1.5 bg-muted/30 rounded-lg p-3">
              {changes.map((c, i) => (
                <div key={i} className="text-[12.5px] text-foreground/85 flex gap-1.5">
                  <span className="text-primary">•</span>
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Back</Button>
            <Button size="sm" onClick={doSave} disabled={saving}>
              {saving ? "Saving…" : "Confirm & save"}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl border bg-card p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold">
            {customer.customerCode} — {customer.name}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading customer data…</div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Customer name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-[14px] mt-1" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-muted-foreground">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-[14px] mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="text-[14px] mt-1" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-muted-foreground">GSTIN</Label>
              <Input value={gstin} onChange={(e) => setGstin(e.target.value)} className="text-[14px] mt-1" />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={loading || !name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
