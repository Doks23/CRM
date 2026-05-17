import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, name: true, email: true, role: true, image: true, avatarUrl: true, createdAt: true },
  });

  return NextResponse.json(user ?? { error: "Not found" });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, avatarUrl } = (await req.json()) as { name?: string; avatarUrl?: string };

  const set: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    set.name = trimmed;
  }
  if (avatarUrl !== undefined) {
    set.avatarUrl = avatarUrl;
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(set)
    .where(eq(users.id, session.user.id))
    .returning({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl });

  return NextResponse.json(updated);
}
