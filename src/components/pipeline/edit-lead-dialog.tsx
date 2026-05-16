"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
  };
}

export function EditLeadDialog({ leadId, initial }: EditLeadDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial.contactName ?? "");
  const [company, setCompany] = useState(initial.company ?? "");
  const [error, setError] = useState<string | null>(null);

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
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Save failed");
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        title="Edit contact details"
        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/8 transition-colors"
      >
        <Pencil className="size-3" />
      </button>
      <SheetContent side="right" className="w-[340px] sm:max-w-[340px]">
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
          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}
        </div>
        <SheetFooter className="px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
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
