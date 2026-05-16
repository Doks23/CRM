"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
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
  const daysSinceActivity = daysAgo(lead.lastActivityAt);
  const assignee = users.find(u => u.id === lead.assignedUserId);

  const markNotInterested = () => {
    startTransition(async () => {
      await fetch(`/api/leads/${lead.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "nurture" }),
      });
      setDismissed(true);
      router.refresh();
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
      <Link
        href={lead.latestThreadId ? `/inbox/${lead.latestThreadId}` : "#"}
        className="block p-3 pb-1"
        onClick={(e) => { if (!lead.latestThreadId) e.preventDefault(); }}
      >
        <div className="font-medium truncate">
          {lead.contactName || lead.primaryEmail}
        </div>
        {lead.company ? (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {lead.company}
          </div>
        ) : null}
        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
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
      </Link>
      <div className="flex items-center justify-between px-3 pb-2 pt-1 gap-1">
        <div className="flex items-center gap-1">
          <EditLeadDialog
            leadId={lead.id}
            initial={{ contactName: lead.contactName, company: lead.company, primaryEmail: lead.primaryEmail }}
          />
          <button
            onClick={markNotInterested}
            disabled={isPending}
            title="Mark as not interested"
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-neg hover:bg-neg-tint transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
        {assignee ? (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
            {assignee.name || assignee.email}
          </span>
        ) : null}
        <AssignDialog leadId={lead.id} currentUserId={lead.assignedUserId} sessionUserId={sessionUserId} users={users} />
      </div>
    </div>
  );
}

function daysAgo(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}
