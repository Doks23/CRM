"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, ShieldCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SmartAvatar } from "@/components/app/smart-avatar";
import { Badge } from "@/components/ui/badge";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

interface Props {
  users: UserRow[];
}

const ROLE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
];

export function EmployeeManager({ users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("sales");
  const [error, setError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);

  const handleAdd = () => {
    setError(null);
    setCreatedInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to add");
        }
        const data = await res.json();
        setCreatedInfo({ email: email.trim(), password: data.defaultPassword });
        setEmail("");
        setName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  };

  const handleRemove = (removeEmail: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: removeEmail }),
        });
        if (!res.ok) throw new Error("Failed to remove");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  };

  const owners = users.filter((u) => u.role === "owner");
  const employees = users.filter((u) => u.role !== "owner");

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-[26px] serif leading-tight">Employees</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">
          Add and manage team members. Each employee gets a default password to sign in.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl">
        {/* Add employee form */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            <h2 className="text-[16px] font-semibold">Add employee</h2>
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="text-[14px]"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="text-[14px]"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Role
              </Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[14px] shadow-sm"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isPending || !email.trim()}
            >
              {isPending ? "Adding…" : "Add"}
            </Button>
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          {createdInfo && (
            <PasswordReveal email={createdInfo.email} password={createdInfo.password} />
          )}
        </Card>

        {/* Employees */}
        <section>
          <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Team members ({employees.length})
          </h2>
          <div className="space-y-2">
            {employees.map((u) => (
              <Card key={u.id} className="p-3 flex items-center gap-3">
                <SmartAvatar name={u.name ?? u.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate">{u.name || "—"}</div>
                  <div className="text-[12.5px] text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant="outline" className="text-[11px] capitalize">
                  {u.role}
                </Badge>
                <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handleRemove(u.email)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </Card>
            ))}
            {employees.length === 0 && (
              <p className="text-[14px] text-muted-foreground py-4 text-center">
                No team members yet. Add one above.
              </p>
            )}
          </div>
        </section>

        {/* Owner */}
        <section>
          <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Owner ({owners.length})
          </h2>
          <div className="space-y-2">
            {owners.map((u) => (
              <Card key={u.id} className="p-3 flex items-center gap-3">
                <SmartAvatar name={u.name ?? u.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium truncate">{u.name || u.email}</span>
                    <ShieldCheck className="size-3.5 text-pos" />
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant="outline" className="text-[11px] capitalize">
                  owner
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PasswordReveal({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`${email}\n${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 space-y-2">
      <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
        Employee created!
      </p>
      <div className="text-[13px] text-emerald-700 dark:text-emerald-400 space-y-1">
        <p>Email: <span className="font-mono">{email}</span></p>
        <p>Default password: <span className="font-mono">{password}</span></p>
      </div>
      <Button size="xs" variant="outline" className="h-7 text-[12px] gap-1.5" onClick={copy}>
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy credentials"}
      </Button>
    </div>
  );
}
