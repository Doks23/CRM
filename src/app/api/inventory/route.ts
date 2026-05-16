import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventory, stockMovements, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: inventory.id,
      productId: inventory.productId,
      quantity: inventory.quantity,
      updatedAt: inventory.updatedAt,
      sku: products.sku,
      productName: products.name,
      grade: products.grade,
      packSize: products.packSize,
      moq: products.moq,
      stockNote: products.stockNote,
      movementCount: sql<number>`(select count(*) from ${stockMovements} sm where sm.inventory_id = ${inventory.id})`.mapWith(Number),
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .orderBy(products.name);

  return NextResponse.json(rows);
}
