import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, phone, company, address, gstin, notes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const lastCustomer = await db
    .select({ code: customers.customerCode })
    .from(customers)
    .orderBy(desc(customers.customerCode))
    .limit(1)
    .then((r) => r[0] ?? null);

  let nextNum = 1;
  if (lastCustomer) {
    const match = lastCustomer.code.match(/CUST-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const customerCode = `CUST-${String(nextNum).padStart(4, "0")}`;

  try {
    const [customer] = await db
      .insert(customers)
      .values({
        customerCode,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        address: address?.trim() || null,
        gstin: gstin?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();

    return NextResponse.json(customer, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "A customer with this code already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
