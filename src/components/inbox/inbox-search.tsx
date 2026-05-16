"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Compact search input for the Inbox toolbar.
 *
 * Preserves the rest of the query string (e.g. ?filter=drafts_ready) so
 * filter + search stack correctly. The submit-on-Enter pattern beats
 * live-search at small volume — quieter API surface, no debounce needed.
 */
export function InboxSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const q = (data.get("q") as string | null)?.trim() ?? "";
    const params = new URLSearchParams(searchParams);
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`/inbox${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative ml-auto w-full max-w-[260px]"
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        name="q"
        defaultValue={initialQuery}
        placeholder="Search threads…"
        className="w-full h-7 pl-7 pr-7 rounded text-[12px] bg-muted/40 border border-transparent hover:border-input focus:bg-background focus:border-input focus:outline-none transition-colors placeholder:text-muted-foreground"
      />
      {initialQuery && (
        <button
          type="button"
          onClick={() => router.push("/inbox")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </form>
  );
}
