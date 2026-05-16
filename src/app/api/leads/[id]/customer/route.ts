import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { auth } from "@/auth";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { customerId } = await req.json();

  const [updated] = await db
    .update(leads)
    .set({ customerId: customerId || null })
    .where(eq(leads.id, id))
    .returning({ id: leads.id, customerId: leads.customerId });

  if (!updated) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
