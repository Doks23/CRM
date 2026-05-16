import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { sampleDispatches } from "@/db/schema";

const FOLLOWUP_DAYS_DEFAULT = 3;

/**
 * POST /api/samples
 *
 * Owner/sales create a new sample dispatch attached to a lead.
 * Minimum body: { leadId }. Everything else optional.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<{
    leadId: string;
    productId: string | null;
    sku: string | null;
    quantityNote: string | null;
    courier: string | null;
    awb: string | null;
    sentAt: string | null;
    note: string | null;
  }>;

  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const sentAt = body.sentAt ? new Date(body.sentAt) : null;
  const status = sentAt ? "in_transit" : "pending_dispatch";

  const [row] = await db
    .insert(sampleDispatches)
    .values({
      leadId: body.leadId,
      productId: body.productId ?? undefined,
      sku: body.sku ?? undefined,
      quantityNote: body.quantityNote ?? undefined,
      courier: body.courier ?? undefined,
      awb: body.awb ?? undefined,
      sentAt: sentAt ?? undefined,
      note: body.note ?? undefined,
      status,
    })
    .returning();

  return NextResponse.json(row);
}

/** GET /api/samples?leadId=... — recent samples for a lead. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(sampleDispatches)
    .where(eq(sampleDispatches.leadId, leadId))
    .orderBy(desc(sampleDispatches.createdAt))
    .limit(20);

  return NextResponse.json(rows);
}

export { FOLLOWUP_DAYS_DEFAULT };
