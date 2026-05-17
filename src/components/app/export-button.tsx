"use client";

import { useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ExportButton({ range }: { range: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleExport = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/reports/export?range=${range}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] ?? `reports-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={state === "loading"}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {state === "loading" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-3.5" />
      ) : (
        <Download className="size-3.5" />
      )}
      {state === "loading" ? "Exporting…" : state === "done" ? "Exported!" : "Export CSV"}
    </button>
  );
}
