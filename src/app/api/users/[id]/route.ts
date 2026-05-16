import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** PATCH /api/users/[id] — owner can activate or deactivate a team member. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return NextResponse.json({ error: "Only owner can manage users" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { active } = (await req.json()) as { active: boolean };

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ active })
    .where(eq(users.id, id))
    .returning({ id: users.id, active: users.active });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
