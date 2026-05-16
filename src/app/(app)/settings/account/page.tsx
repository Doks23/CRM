"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SmartAvatar } from "@/components/app/smart-avatar";

export default function AccountPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwPending, startPwTransition] = useTransition();
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const user = session?.user;

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Save failed");
        }
        await updateSession({ name });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  const handleChangePassword = () => {
    setPwError(null);
    setPwSaved(false);
    startPwTransition(async () => {
      try {
        const res = await fetch("/api/users/password", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to change password");
        }
        setPwSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        router.refresh();
      } catch (e) {
        setPwError(e instanceof Error ? e.message : "Failed to change password");
      }
    });
  };

  if (!user) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold -tracking-[0.01em]">My account</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          Your personal details and sign-in settings.
        </p>
      </header>

      <Card className="p-5 gap-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <SmartAvatar name={user.name ?? user.email ?? "?"} size="xl" />
          <div>
            <div className="font-semibold text-[16px]">{user.name || "—"}</div>
            <div className="text-[13.5px] text-muted-foreground">{user.email}</div>
            <Badge variant="outline" className="capitalize text-[12px] mt-1">
              {(user as { role?: string }).role ?? "sales"}
            </Badge>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Display name
            </Label>
            <div className="flex gap-2">
              <Input
                id="acc-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                placeholder="Your full name"
                className="max-w-xs text-[14px]"
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || !name.trim() || name.trim() === (user.name ?? "")}
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
            {saved && <p className="text-[13px] text-pos">Name updated.</p>}
            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>

          {/* Email — read only */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Email
            </Label>
            <Input value={user.email ?? ""} disabled className="max-w-xs text-[14px] bg-muted/40" />
          </div>

          {/* Change password */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Password
            </Label>
            <div className="space-y-2 max-w-xs">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPwSaved(false); }}
                placeholder="Current password"
                className="text-[14px]"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPwSaved(false); }}
                placeholder="New password (min 6 chars)"
                className="text-[14px]"
              />
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={pwPending || !currentPassword || !newPassword || newPassword.length < 6}
              >
                {pwPending ? "Changing…" : "Change password"}
              </Button>
            </div>
            {pwSaved && <p className="text-[13px] text-pos">Password updated.</p>}
            {pwError && <p className="text-[13px] text-destructive">{pwError}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
