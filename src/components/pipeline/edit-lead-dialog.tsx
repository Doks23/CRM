"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
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

interface EditLeadDialogProps {
  leadId: string;
  initial: {
    contactName: string | null;
    company: string | null;
    primaryEmail: string;
    phone: string | null;
    notesForAi: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLeadDialog({ leadId, initial, open, onOpenChange }: EditLeadDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial.contactName ?? "");
  const [company, setCompany] = useState(initial.company ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [notes, setNotes] = useState(initial.notesForAi ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial.contactName ?? "");
      setCompany(initial.company ?? "");
      setPhone(initial.phone ?? "");
      setNotes(initial.notesForAi ?? "");
      setError(null);
    }
  }, [open, initial.contactName, initial.company, initial.phone, initial.notesForAi]);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: name || null,
            company: company || null,
            phone: phone || null,
            notesForAi: notes || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Save failed");
        }
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[340px] sm:max-w-[340px]">
        <SheetHeader>
          <SheetTitle>Edit contact</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="el-email" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Email
            </Label>
            <Input
              id="el-email"
              value={initial.primaryEmail}
              disabled
              className="text-[14px] bg-muted/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="el-name" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contact name
            </Label>
            <Input
              id="el-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-[14px]"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="el-phone" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Phone
            </Label>
            <Input
              id="el-phone"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-[14px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="el-company" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </Label>
            <Input
              id="el-company"
              placeholder="Company or org name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="text-[14px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="el-notes" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Notes for AI
            </Label>
            <textarea
              id="el-notes"
              rows={4}
              placeholder="Context the AI should know when drafting replies…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-[14px] shadow-sm resize-none"
            />
          </div>
          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}
        </div>
        <SheetFooter className="px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
