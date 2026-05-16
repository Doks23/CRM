import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "currentPassword and newPassword required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, hash: true },
  });
  if (!user || !user.hash) {
    return NextResponse.json({ error: "Password login not enabled for this account" }, { status: 400 });
  }

  const valid = await compare(currentPassword, user.hash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

  const hashed = await hash(newPassword, 12);
  await db.update(users).set({ hash: hashed }).where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
