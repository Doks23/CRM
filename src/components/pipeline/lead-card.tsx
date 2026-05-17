"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignDialog } from "./assign-dialog";
import { EditLeadDialog } from "./edit-lead-dialog";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface LeadCardData {
  id: string;
  leadCode: string;
  contactName: string | null;
  primaryEmail: string;
  company: string | null;
  phone: string | null;
  notesForAi: string | null;
  leadType: string;
  stage: string;
  score: number | null;
  lastActivityAt: Date | string;
  messageCount: number;
  latestThreadId: string | null;
  assignedUserId: string | null;
}

export function LeadCard({
  lead,
  isDragging,
  users,
  sessionUserId,
}: {
  lead: LeadCardData;
  isDragging: boolean;
  users: UserData[];
  sessionUserId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const daysSinceActivity = daysAgo(lead.lastActivityAt);
  const assignee = users.find(u => u.id === lead.assignedUserId);

  const deleteLead = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${lead.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to delete");
        }
        setDismissed(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  if (dismissed) return null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
      }}
      className={cn(
        "rounded-lg border bg-card text-left text-sm hover:shadow-sm transition-shadow",
        isDragging && "opacity-50",
        isPending && "opacity-60",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="block p-3 pb-1 cursor-pointer"
        onClick={() => setEditDialogOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditDialogOpen(true); }}
      >
        <div className="font-medium truncate flex items-center gap-2">
          {lead.contactName || lead.primaryEmail}
          <span className="text-[10px] font-mono text-muted-foreground">{lead.leadCode}</span>
        </div>
        {lead.company ? (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {lead.company}
          </div>
        ) : null}
        <div className="flex items-center gap-2 mt-2 text-[12px] text-muted-foreground">
          <span className="capitalize">{lead.leadType.replace(/_/g, " ")}</span>
          {lead.messageCount > 0 ? (
            <>
              <span>·</span>
              <span>{lead.messageCount} msgs</span>
            </>
          ) : null}
          <span className="ml-auto">
            {daysSinceActivity === 0 ? "today" : daysSinceActivity === 1 ? "1d ago" : `${daysSinceActivity}d ago`}
          </span>
        </div>
      </div>
      {confirmDelete && (
        <div className="mx-3 mb-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[12px]">
          <p className="text-destructive font-medium mb-1.5">Delete this lead?</p>
          <div className="flex gap-1.5">
            <button
              onClick={deleteLead}
              disabled={isPending}
              className="h-7 rounded bg-destructive text-destructive-foreground px-2.5 text-[11px] font-medium hover:bg-destructive/90 transition-colors"
            >
              {isPending ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="h-7 rounded border px-2.5 text-[11px] font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-3 pb-2 pt-1 gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditDialogOpen(true)}
            title="Edit contact details"
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            title="Delete lead"
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
        {assignee ? (
          <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
            {assignee.name || assignee.email}
          </span>
        ) : null}
        <AssignDialog leadId={lead.id} currentUserId={lead.assignedUserId} sessionUserId={sessionUserId} users={users} />
      </div>
      {error && (
        <div className="px-3 pb-2 flex items-center gap-1 text-[11px] text-destructive">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="line-clamp-1">{error}</span>
        </div>
      )}
      <EditLeadDialog
        leadId={lead.id}
        initial={{
          contactName: lead.contactName,
          company: lead.company,
          primaryEmail: lead.primaryEmail,
          phone: lead.phone,
          notesForAi: lead.notesForAi,
        }}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}

function daysAgo(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}
