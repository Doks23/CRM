import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { leads } from "@/db/schema";

/**
 * PATCH /api/leads/[id]
 *
 * Owner / sales can edit per-lead fields the AI consumes when drafting.
 * Currently exposes `notesForAi` only — extend as more lead fields go
 * editable.
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
    notesForAi: string | null;
    phone: string | null;
    contactName: string | null;
    company: string | null;
    primaryEmail: string | null;
  }>;

  const updates: Record<string, unknown> = {};

  // Trim string fields aggressively; empty string → null so AI prompt blocks
  // and UI badges disappear cleanly.
  function trimOrNull(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  }

  if (body.notesForAi !== undefined)  updates.notesForAi    = trimOrNull(body.notesForAi);
  if (body.phone !== undefined)       updates.phone         = trimOrNull(body.phone);
  if (body.contactName !== undefined) updates.contactName   = trimOrNull(body.contactName);
  if (body.company !== undefined)     updates.company       = trimOrNull(body.company);
  if (body.primaryEmail !== undefined) updates.primaryEmail = trimOrNull(body.primaryEmail);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(leads)
    .set(updates)
    .where(eq(leads.id, id))
    .returning({
      id: leads.id,
      notesForAi: leads.notesForAi,
      phone: leads.phone,
      contactName: leads.contactName,
      company: leads.company,
      primaryEmail: leads.primaryEmail,
    });

  if (!updated) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/leads/[id]
 *
 * Soft delete — sets deletedAt so the lead disappears from every list
 * without touching its emails or drafts (kept for audit + thread integrity).
 */
export async function DELETE(
  _req: NextRequest,
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

  const [updated] = await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(eq(leads.id, id))
    .returning({ id: leads.id });

  if (!updated) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", id: updated.id });
}
