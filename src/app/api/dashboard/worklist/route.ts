import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadInboundTrend, loadWorklist } from "@/lib/queries/worklist";

/**
 * GET /api/dashboard/worklist
 *
 * Mobile-ready JSON shape of the home dashboard:
 *   - five tiles for today's worklist
 *   - 14-day inbound trend
 *
 * Server component on the desktop hits the same library functions for SSR.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tiles, trend] = await Promise.all([
    loadWorklist(),
    loadInboundTrend(14),
  ]);

  return NextResponse.json({ tiles, trend });
}
