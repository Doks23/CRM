import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  countInboxTabs,
  listInboxThreads,
  type InboxFilter,
} from "@/lib/queries/inbox";

const VALID_FILTERS: InboxFilter[] = ["all", "new", "draft"];

/**
 * GET /api/inbox/threads
 *
 * Same data the desktop inbox renders via SSR — exposed as JSON so the
 * future mobile client can consume it directly without re-implementing the
 * SQL. Query params:
 *   filter = "all" | "new" | "draft"                   (default "all")
 *   q       = search string                            (optional)
 *   limit   = max rows                                 (default 100)
 *   counts  = "1" to include per-tab counts in the response
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const filterParam = url.searchParams.get("filter") ?? "all";
  const filter: InboxFilter = (VALID_FILTERS as string[]).includes(filterParam)
    ? (filterParam as InboxFilter)
    : "all";
  const q = url.searchParams.get("q");
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? "100")),
  );
  const wantCounts = url.searchParams.get("counts") === "1";

  const [threads, counts] = await Promise.all([
    listInboxThreads({ filter, query: q, limit }),
    wantCounts ? countInboxTabs(q) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    threads,
    counts,
    filter,
    query: q,
  });
}
