import { db } from "@/db";
import { ProductList } from "@/components/settings/product-list";

export const dynamic = "force-dynamic";

export default async function SettingsProductsPage() {
  const allProducts = await db.query.products.findMany();
  return (
    <div className="space-y-4">
      <header>
        <h1>Product catalog</h1>
        <p className="text-meta">
          SKUs, grades, MOQ and pricing. Active products are passed to the AI on
          every draft.
        </p>
      </header>
      <ProductList initial={allProducts} />
    </div>
  );
}
