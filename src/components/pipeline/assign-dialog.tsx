"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export function AssignDialog({ leadId, currentUserId, sessionUserId, users }: { leadId: string; currentUserId: string | null; sessionUserId: string | null; users: User[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const assign = (userId: string | null) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) return;
        setOpen(false);
        router.refresh();
      } catch { /* ignore */ }
    });
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setOpen(!open)}
        aria-label="Assign user"
        aria-expanded={open}
      >
        <UserPlus className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-popover p-1 shadow-md z-50"
          role="menu"
        >
          {sessionUserId && sessionUserId !== currentUserId && (
            <button
              role="menuitem"
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted font-medium text-primary"
              onClick={() => assign(sessionUserId)}
              disabled={isPending}
            >
              Assign to me
            </button>
          )}
          {users.length === 0 && (
            <div className="px-3 py-1.5 text-sm text-muted-foreground">No users</div>
          )}
          {users.map(u => (
            <button
              key={u.id}
              role="menuitem"
              className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted ${currentUserId === u.id ? "bg-muted font-medium" : ""}`}
              onClick={() => assign(u.id)}
              disabled={isPending}
            >
              {u.name || u.email}
            </button>
          ))}
          {currentUserId && (
            <button
              role="menuitem"
              className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground rounded hover:bg-muted"
              onClick={() => assign(null)}
              disabled={isPending}
            >
              Unassign
            </button>
          )}
        </div>
      )}
    </div>
  );
}
