"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadCard } from "./lead-card";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const STAGES = [
  { key: "new",         label: "New",         color: "bg-blue-500"   },
  { key: "qualified",   label: "Qualified",   color: "bg-emerald-500" },
  { key: "info_sent",   label: "Info Sent",   color: "bg-cyan-500"   },
  { key: "negotiation", label: "Negotiation", color: "bg-violet-500" },
  { key: "po_received", label: "PO Received", color: "bg-orange-500" },
  { key: "dispatched",  label: "Dispatched",  color: "bg-indigo-500" },
  { key: "won",         label: "Won",         color: "bg-green-600"  },
  { key: "lost",        label: "Lost",        color: "bg-red-500"    },
] as const;

interface LeadData {
  id: string;
  leadCode: string;
  contactName: string | null;
  primaryEmail: string;
  company: string | null;
  leadType: string;
  stage: string;
  score: number | null;
  lastActivityAt: Date | string;
  messageCount: number;
  latestThreadId: string | null;
  assignedUserId: string | null;
}

export function KanbanBoard({
  leadsByStage,
  users,
  sessionUserId,
}: {
  leadsByStage: Record<string, LeadData[]>;
  users: UserData[];
  sessionUserId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDrop = (stage: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;

    startTransition(async () => {
      try {
        await fetch("/api/leads/stage", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, stage }),
        });
        router.refresh();
      } catch (err) {
        console.error("Failed to move lead stage:", err);
      }
    });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {STAGES.map((stage) => {
        const leads = leadsByStage[stage.key] ?? [];
        return (
          <div
            key={stage.key}
            onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key); }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={handleDrop(stage.key)}
            className={`flex-shrink-0 w-72 flex flex-col rounded-lg border bg-muted/20 ${dragOverStage === stage.key ? "ring-2 ring-primary" : ""}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b">
              <span className={`h-2 w-2 rounded-full ${stage.color}`} />
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{leads.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {leads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Drop a lead here</p>
              ) : (
                leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} isDragging={isPending} users={users} sessionUserId={sessionUserId} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
