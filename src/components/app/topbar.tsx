"use client";

import { Menu, Search, Bell, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/providers";

/**
 * Sticky app topbar with hamburger + search + sync status + new action + user menu.
 * `userMenu` must be passed as a prop from a server component (it's an async server component).
 */
export function Topbar({
  syncedLabel = "Gmail · synced 2m ago",
  newButton,
  userMenu,
}: {
  syncedLabel?: string;
  newButton?: React.ReactNode;
  userMenu?: React.ReactNode;
}) {
  const { toggle } = useSidebar();

  return (
    <header className="h-[60px] flex items-center gap-2 lg:gap-3 px-3 lg:px-7 border-b border-border bg-background">
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden size-9 grid place-items-center rounded-lg hover:bg-foreground/5 shrink-0"
        onClick={toggle}
        aria-label="Open menu"
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>

      {/* Search — hidden on mobile */}
      <div className="hidden lg:flex flex-1 max-w-[520px] h-9 px-3 items-center gap-2.5 rounded-[10px] bg-card border border-border text-muted-foreground text-[14.5px] shadow-[0_1px_0_rgba(20,14,8,.03),_0_1px_2px_rgba(20,14,8,.04)]">
        <Search className="size-4 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate">
          Search leads, threads, products, anything…
        </span>
        <kbd className="font-mono text-[12px] px-1.5 py-px rounded bg-muted border border-border">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2 ml-auto">
        {/* Sync pill — compact on mobile */}
        <span className="inline-flex items-center gap-1.5 h-7 px-2 lg:px-2.5 rounded-full bg-card border border-border text-[12px] lg:text-[13px] font-medium text-foreground/80">
          <span className="relative inline-flex size-2 rounded-full bg-pos">
            <span className="absolute inset-0 rounded-full bg-pos animate-ping opacity-60" />
          </span>
          <span className="hidden sm:inline">{syncedLabel}</span>
          <span className="sm:hidden">Live</span>
        </span>

        {/* Desktop-only items */}
        <div className="hidden lg:flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>

          <Button variant="ghost" size="icon-sm" aria-label="Re-sync">
            <RefreshCw className="size-4" />
          </Button>

          {newButton ?? (
            <Button
              size="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,_0_6px_18px_oklch(0.48_0.11_162/0.32)]"
            >
              <Plus className="size-4" strokeWidth={2} data-icon="inline-start" />
              New
            </Button>
          )}
        </div>

        {userMenu}
      </div>
    </header>
  );
}
