"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteLeadButton({ leadId, leadCode }: { leadId: string; leadCode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete lead ${leadCode}? Emails are kept; the lead is hidden from every list.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Delete failed: ${j.error ?? res.statusText}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Delete lead"
      className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-neg disabled:opacity-50"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
