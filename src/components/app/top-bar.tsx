import { Plus, Search } from "lucide-react";

import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

/**
 * Global app top bar (~48px). Always visible above the page content.
 *
 * Holds:
 *   - Global search box (Cmd/Ctrl + K placeholder — not yet functional)
 *   - Quick-create "+ New" button (placeholder dropdown for now)
 *   - User menu (avatar + role + sign out)
 *
 * Intentionally quiet visually — the page header below is where titles
 * and page actions live.
 */
export function TopBar() {
  return (
    <header className="h-12 bg-card border-b flex items-center px-4 gap-3">
      {/* Global search — full functionality in a later pass */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search leads, threads, products…"
          aria-label="Global search"
          className="w-full h-8 pl-8 pr-12 text-[13px] rounded-md bg-muted/40 border border-transparent hover:border-input focus:bg-card focus:border-input focus:outline-none transition-colors placeholder:text-muted-foreground"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground pointer-events-none px-1.5 py-0.5 rounded border bg-card">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      {/* Quick-create — most-used button in any CRM. Wired up properly in Wave 2. */}
      <Button size="sm" className="h-8">
        <Plus className="h-3.5 w-3.5 mr-1" />
        New
      </Button>

      <UserMenu />
    </header>
  );
}
