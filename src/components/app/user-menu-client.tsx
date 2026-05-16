"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = "owner" | "sales" | "production";

const roleLabels: Record<Role, string> = {
  owner: "Owner",
  sales: "Sales",
  production: "Production",
};

export function UserMenuClient({
  name,
  email,
  image,
  role,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
}) {
  const initials =
    (name ?? email ?? "?")
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md px-2 py-1.5 transition-colors">
        <Avatar className="h-7 w-7">
          {image ? (
            <AvatarImage src={image} alt={name ?? email ?? ""} />
          ) : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium leading-tight">
            {name ?? email}
          </div>
          <div className="text-xs text-zinc-500 leading-tight">
            {roleLabels[role]}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm">{name ?? "Unknown"}</span>
            <span className="text-xs text-zinc-500">{email}</span>
            <Badge variant="secondary" className="mt-1.5 w-fit">
              {roleLabels[role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
