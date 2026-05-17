"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

export function CreateLeadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [leadType, setLeadType] = useState("inquiry");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setContactName("");
    setCompany("");
    setLeadType("inquiry");
    setError(null);
  };

  const handleCreate = () => {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, contactName, company, leadType }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to create lead");
        }
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create lead");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" strokeWidth={2} /> Add deal
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle>Create new deal</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-2 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cl-email" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email *
              </Label>
              <Input
                id="cl-email"
                type="email"
                placeholder="contact@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="text-[14px]"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-name" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Contact name
              </Label>
              <Input
                id="cl-name"
                placeholder="Full name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="text-[14px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-company" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </Label>
              <Input
                id="cl-company"
                placeholder="Company or org name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="text-[14px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-type" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lead type
              </Label>
              <select
                id="cl-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
              >
                <option value="inquiry">Inquiry</option>
                <option value="bulk">Bulk</option>
                <option value="retail">Retail</option>
                <option value="export">Export</option>
                <option value="sample_request">Sample request</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>
          <SheetFooter className="px-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setOpen(false); reset(); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isPending || !email.trim()}
            >
              {isPending ? "Creating…" : "Create deal"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
