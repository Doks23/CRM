import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, id),
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const allowed = ["name", "email", "phone", "company", "address", "gstin", "notes"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = typeof body[key] === "string" ? body[key].trim() || null : body[key];
    }
  }
  if (!updates.name) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(customers)
    .set(updates)
    .where(eq(customers.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
