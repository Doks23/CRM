import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { sampleDispatches } from "@/db/schema";

const FOLLOWUP_DAYS_DEFAULT = 3;

const VALID_STATUSES = new Set([
  "pending_dispatch",
  "in_transit",
  "delivered",
  "follow_up_sent",
  "closed",
]);

/**
 * PATCH /api/samples/[id]
 *
 * Updates a single field or status. When `deliveredAt` is set, the follow-up
 * cron's due date is auto-computed (deliveredAt + N days) if not provided.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<{
    courier: string | null;
    awb: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    followUpDueAt: string | null;
    quantityNote: string | null;
    sku: string | null;
    status: string;
    note: string | null;
  }>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  function setIfPresent<K extends keyof typeof body>(key: K) {
    if (body[key] !== undefined) updates[key as string] = body[key];
  }

  setIfPresent("courier");
  setIfPresent("awb");
  setIfPresent("quantityNote");
  setIfPresent("sku");
  setIfPresent("note");

  if (body.sentAt !== undefined) {
    updates.sentAt = body.sentAt ? new Date(body.sentAt) : null;
  }

  if (body.deliveredAt !== undefined) {
    const delivered = body.deliveredAt ? new Date(body.deliveredAt) : null;
    updates.deliveredAt = delivered;
    // Compute follow-up due if the caller didn't supply one.
    if (delivered && body.followUpDueAt === undefined) {
      updates.followUpDueAt = new Date(
        delivered.getTime() + FOLLOWUP_DAYS_DEFAULT * 86_400_000,
      );
      // Bump status if we're still earlier in the funnel.
      const current = await db.query.sampleDispatches.findFirst({
        where: eq(sampleDispatches.id, id),
      });
      if (current && current.status !== "follow_up_sent" && current.status !== "closed") {
        updates.status = "delivered";
      }
    }
  }

  if (body.followUpDueAt !== undefined) {
    updates.followUpDueAt = body.followUpDueAt
      ? new Date(body.followUpDueAt)
      : null;
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(sampleDispatches)
    .set(updates)
    .where(eq(sampleDispatches.id, id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Sample not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}
