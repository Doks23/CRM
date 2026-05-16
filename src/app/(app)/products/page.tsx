import { db } from "@/db";
import { ProductList } from "@/components/settings/product-list";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const allProducts = await db.query.products.findMany();
  return (
    <div className="p-5 lg:p-6 max-w-4xl space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold -tracking-[0.01em]">Product catalog</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          SKUs, grades, MOQ and pricing. Active products are passed to the AI on every draft.
        </p>
      </header>
      <ProductList initial={allProducts} />
    </div>
  );
}
