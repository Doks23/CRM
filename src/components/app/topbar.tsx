import { Search, Bell, Plus, RefreshCw } from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";

/**
 * Sticky app topbar with search + sync status + new action + user menu.
 * Drop directly into the (app) layout above {children}.
 */
export function Topbar({
  syncedLabel = "Gmail · synced 2m ago",
  newButton,
}: {
  syncedLabel?: string;
  newButton?: React.ReactNode;
}) {
  return (
    <header className="h-[60px] flex items-center gap-3 px-7 border-b border-border bg-background">
      <div className="flex-1 max-w-[520px] h-9 px-3 flex items-center gap-2.5 rounded-[10px] bg-card border border-border text-muted-foreground text-[14.5px] shadow-[0_1px_0_rgba(20,14,8,.03),_0_1px_2px_rgba(20,14,8,.04)]">
        <Search className="size-4 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate">
          Search leads, threads, products, anything…
        </span>
        <kbd className="font-mono text-[12px] px-1.5 py-px rounded bg-muted border border-border">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-card border border-border text-[13px] font-medium text-foreground/80">
          <span className="relative inline-flex size-2 rounded-full bg-pos">
            <span className="absolute inset-0 rounded-full bg-pos animate-ping opacity-60" />
          </span>
          {syncedLabel}
        </span>

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

        <UserMenu />
      </div>
    </header>
  );
}
