import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users, businessProfile } from "@/db/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return NextResponse.json({ error: "Only owner can manage team" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.role !== undefined) {
    if (!["sales", "production"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    await db.update(users).set({ role: body.role }).where(eq(users.id, id));

    const profile = await db.query.businessProfile.findFirst();
    if (profile) {
      const current = profile.allowedEmails ?? [];
      const idx = current.findIndex((a) => a.email === user.email);
      if (idx !== -1) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], role: body.role };
        await db.update(businessProfile).set({ allowedEmails: updated, updatedAt: new Date() }).where(eq(businessProfile.id, profile.id));
      }
    }
  }

  if (body.resetPassword) {
    const hashed = await hash("Temp@123", 12);
    await db.update(users).set({ hash: hashed }).where(eq(users.id, id));
  }

  return NextResponse.json({ success: true });
}
