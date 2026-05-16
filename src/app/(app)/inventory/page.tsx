import { db } from "@/db";
import { inventory, stockMovements, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
      priceRetail: products.priceRetail,
      priceWholesale: products.priceWholesale,
      stockNote: products.stockNote,
      movementCount: sql<number>`(select count(*) from ${stockMovements} sm where sm.inventory_id = ${inventory.id})`.mapWith(Number),
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .orderBy(products.name);

  return <InventoryClient items={rows} />;
}
