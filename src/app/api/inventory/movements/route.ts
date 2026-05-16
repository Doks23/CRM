import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventory, stockMovements } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { inventoryId, productId, quantity, type, note, leadId } = body;

  if (!inventoryId || !productId || !quantity || !type) {
    return NextResponse.json({ error: "inventoryId, productId, quantity, and type are required" }, { status: 400 });
  }

  const item = await db.query.inventory.findFirst({
    where: eq(inventory.id, inventoryId),
  });
  if (!item) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });

  // Prevent negative stock from going below zero
  const qtyNum = Number(quantity);
  if (item.quantity + qtyNum < 0) {
    return NextResponse.json({ error: `Insufficient stock. Available: ${item.quantity}, requested: ${Math.abs(qtyNum)}` }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx.insert(stockMovements).values({
      inventoryId,
      productId,
      quantity: qtyNum,
      type,
      note: note ?? null,
      leadId: leadId ?? null,
    });
    await tx.update(inventory).set({
      quantity: sql`quantity + ${qtyNum}`,
      updatedAt: new Date(),
    }).where(eq(inventory.id, inventoryId));
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inventoryId = req.nextUrl.searchParams.get("inventoryId");
  if (!inventoryId) {
    return NextResponse.json({ error: "inventoryId required" }, { status: 400 });
  }

  const rows = await db.query.stockMovements.findMany({
    where: eq(stockMovements.inventoryId, inventoryId),
    orderBy: [desc(stockMovements.createdAt)],
    limit: 100,
  });

  return NextResponse.json(rows);
}
