"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Trash2, ShieldCheck, Copy, Check, KeyRound,
} from "lucide-react";
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
  const [adding, setAdding] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [resettingPw, setResettingPw] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    setCreatedInfo(null);
    setAdding(true);
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
      } finally {
        setAdding(false);
      }
    });
  };

  const handleRemove = (removeEmail: string) => {
    if (!window.confirm("Are you sure you want to remove this employee? This action cannot be undone.")) return;
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

  const handleRoleChange = (userId: string, newRole: string) => {
    setChangingRole(userId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        if (!res.ok) throw new Error("Failed to update role");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update role");
      } finally {
        setChangingRole(null);
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setResettingPw(userId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetPassword: true }),
        });
        if (!res.ok) throw new Error("Failed to reset password");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reset password");
      } finally {
        setResettingPw(null);
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

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Add employee form */}
        <Card className="p-5 space-y-4 max-w-3xl">
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
              disabled={adding || !email.trim()}
            >
              {adding ? "Adding\u2026" : "Add"}
            </Button>
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          {createdInfo && (
            <PasswordReveal email={createdInfo.email} password={createdInfo.password} />
          )}
        </Card>

        {/* Employees table */}
        <section>
          <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Team members ({employees.length})
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide hidden sm:table-cell">Created</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <SmartAvatar name={u.name ?? u.email} size="sm" />
                          <span className="font-medium truncate">{u.name || "\u2014"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={changingRole === u.id}
                          className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-[13px] shadow-sm"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-[13px] hidden sm:table-cell">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={resettingPw === u.id}
                            onClick={() => handleResetPassword(u.id)}
                            title="Reset password to Temp@123"
                          >
                            <KeyRound className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            onClick={() => handleRemove(u.email)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-[14px]">
                        No team members yet. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Owner */}
        <section>
          <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Owner ({owners.length})
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[400px]">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[12px] uppercase tracking-wide">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <SmartAvatar name={u.name ?? u.email} size="sm" />
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{u.name || u.email}</span>
                            <ShieldCheck className="size-3.5 text-pos shrink-0" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">{u.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
