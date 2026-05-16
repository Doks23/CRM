"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";

interface TeamData {
  users: { id: string; name: string | null; email: string; role: string; active: boolean }[];
  allowedEmails: { email: string; role: string }[];
}

export function TeamManager({ initial }: { initial: TeamData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sales");
  const [error, setError] = useState<string | null>(null);

  const invitedEmails = initial.allowedEmails;
  const registeredUsers = initial.users;

  // Split into pending (active=false, signed up at least once) and active
  const pendingUsers = registeredUsers.filter((u) => !u.active);
  const activeUsers = registeredUsers.filter((u) => u.active);

  const handleInvite = () => {
    if (!email) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed");
        }
        setEmail("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const handleRemove = (emailToRemove: string) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailToRemove }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to remove");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove user");
      }
    });
  };

  const setActive = (userId: string, active: boolean) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to update");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update user");
      }
    });
  };

  return (
    <div className="space-y-5">

      {/* Pending approval */}
      {pendingUsers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warn">
            Pending approval ({pendingUsers.length})
          </p>
          <div className="space-y-1.5">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-tint px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{u.name || u.email}</span>
                  {u.name && (
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  )}
                </div>
                <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                  {u.role}
                </Badge>
                <button
                  onClick={() => setActive(u.id, true)}
                  disabled={isPending}
                  title="Approve"
                  className="h-7 w-7 rounded flex items-center justify-center text-pos hover:bg-pos/10 transition-colors"
                >
                  <CheckCircle2 className="size-4" />
                </button>
                <button
                  onClick={() => setActive(u.id, false)}
                  disabled={isPending}
                  title="Reject / keep blocked"
                  className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-neg hover:bg-neg-tint transition-colors"
                >
                  <XCircle className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite new */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Invite by email
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Input
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
          </div>
          <div className="space-y-1.5">
            <select
              className="flex h-8 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="sales">Sales</option>
              <option value="production">Production</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <Button size="sm" onClick={handleInvite} disabled={isPending || !email}>
            <Plus className="h-3.5 w-3.5" /> Invite
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Allowlist */}
      {invitedEmails.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Invite list
          </p>
          <div className="space-y-1">
            {invitedEmails.map((a) => (
              <div
                key={a.email}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="flex-1">{a.email}</span>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {a.role}
                </Badge>
                {registeredUsers.some((u) => u.email === a.email && u.active) ? (
                  <Badge className="text-[10px] bg-pos-tint text-pos hover:bg-pos-tint border-transparent">
                    active
                  </Badge>
                ) : registeredUsers.some((u) => u.email === a.email && !u.active) ? (
                  <Badge className="text-[10px] bg-warn-tint text-warn hover:bg-warn-tint border-transparent">
                    pending
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    invited
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleRemove(a.email)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active team */}
      {activeUsers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Active team ({activeUsers.length})
          </p>
          <div className="space-y-1">
            {activeUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{u.name || u.email}</span>
                  {u.name && (
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  )}
                </div>
                <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                  {u.role}
                </Badge>
                {u.role !== "owner" && (
                  <button
                    onClick={() => setActive(u.id, false)}
                    disabled={isPending}
                    title="Deactivate"
                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-neg hover:bg-neg-tint transition-colors"
                  >
                    <XCircle className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
