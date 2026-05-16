"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarHeart,
  Mail,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

const items: Item[] = [
  { href: "/settings/account", label: "My account", icon: UserCircle },
  { href: "/settings/profile", label: "Company & voice", icon: Building2 },
  { href: "/settings/greetings", label: "Greetings", icon: CalendarHeart },
  { href: "/settings/ai", label: "AI providers", icon: Sparkles },
  { href: "/settings/gmail", label: "Gmail connection", icon: Mail },
];

export function SettingsSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-[200px] shrink-0 border-r bg-muted/30 py-3 px-2 overflow-y-auto">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[14px] transition-colors",
                  active
                    ? "bg-card text-foreground font-medium shadow-sm border border-border/60"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-[15px] w-[15px] shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
