import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await db.query.products.findMany({ orderBy: (p, { asc }) => [asc(p.createdAt)] });
  return NextResponse.json(all);
}

const ALLOWED_FIELDS = ["sku", "name", "grade", "packSize", "moq", "priceRetail", "priceWholesale", "stockNote", "active"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Only owner can edit products" }, { status: 403 });

  const body = await req.json();
  if (!body.sku || !body.name) {
    return NextResponse.json({ error: "sku and name are required" }, { status: 400 });
  }

  const values: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) values[key] = body[key];
  }

  const [product] = await db.insert(products).values(values as any).returning();
  return NextResponse.json(product);
}
