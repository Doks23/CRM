"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  Inbox,
  KanbanSquare,
  Users,
  BarChart3,
  Package,
  Leaf,
  Layers,
  Settings,
  ChevronUp,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { useSidebar } from "@/components/providers";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
  badge?: string | number;
};

type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "WORK",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "CATALOG",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Layers },
      { href: "/samples", label: "Samples", icon: Leaf },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/employees", label: "Employees", icon: UserPlus },
    ],
  },
  {
    label: "SETUP",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

const bottomNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  userInitial = "S",
  userName = "Saurabh Dokania",
  userEmail = "doks23@gmail.com",
  userRole = "Owner",
  inboxCount = 0,
  pipelineCount = 0,
  logoUrl = null,
  userAvatar = null,
}: {
  userInitial?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  inboxCount?: number;
  pipelineCount?: number;
  logoUrl?: string | null;
  userAvatar?: string | null;
}) {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();

  const dynamicBadges: Record<string, number | undefined> = {
    "/inbox": inboxCount > 0 ? inboxCount : undefined,
    "/pipeline": pipelineCount > 0 ? pipelineCount : undefined,
  };

  const sidebarContent = (
    <>
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <Link href="/dashboard" className="block" onClick={() => setOpen(false)}>
          <BrandMark logoUrl={logoUrl} />
        </Link>
        <button
          className="lg:hidden size-8 grid place-items-center rounded-md hover:bg-foreground/5"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-5 overflow-y-auto">
        {groups
          .filter((g) => g.label !== "ADMIN" || userRole === "owner")
          .map((g) => (
          <div key={g.label}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const badge = dynamicBadges[item.href];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] transition-all",
                      active
                        ? "bg-sidebar-accent text-foreground font-medium shadow-[0_1px_0_rgba(20,14,8,.04),_0_1px_3px_rgba(20,14,8,.05)]"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute -left-3.5 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                      strokeWidth={1.6}
                    />
                    <span className="flex-1">{item.label}</span>
                    {badge != null && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[11.5px] font-semibold tabular-nums",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-foreground/[0.06] text-foreground/70"
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-3 px-2 py-2.5 flex items-center gap-2.5 border-t border-sidebar-border pt-3">
        <div className="relative size-8 rounded-lg overflow-hidden bg-gradient-to-br from-[oklch(0.66_0.16_150)] to-[oklch(0.48_0.11_162)] text-white text-xs font-semibold grid place-items-center shrink-0">
          {userAvatar ? (
            <Image
              src={userAvatar}
              alt={userName}
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            userInitial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium leading-tight truncate">
            {userName}
          </div>
          <div className="text-[11.5px] text-muted-foreground truncate">
            {userRole} · {userEmail}
          </div>
        </div>
        <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[232px] shrink-0 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[280px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-background border-t border-border flex items-center justify-around safe-area-bottom">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          const badge = dynamicBadges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
                {badge != null && (
                  <span className="absolute -top-1 -right-1.5 size-3.5 rounded-full bg-primary text-[8px] font-bold text-primary-foreground grid place-items-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-14">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
