import { db } from "@/lib/db";
import { AdminIngredientsPanel } from "@/components/admin-ingredients-panel";
import { Eyebrow } from "@/components/ui";

export default async function AdminIngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const filter = view === "low" ? "low" : view === "ok" ? "ok" : "all";

  const [ingredients, products] = await Promise.all([
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
    db.product.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        linerWidth: true,
        linerHeight: true,
        linerShape: true,
      },
    }),
  ]);

  const rows = ingredients.map((i) => {
    const onHand = Number(i.qtyOnHandBase);
    const threshold = Number(i.reorderThresholdBase);
    const low = threshold > 0 && onHand < threshold;
    const pct =
      threshold > 0 ? Math.min(100, Math.round((onHand / Math.max(threshold, 1)) * 100)) : 100;
    return {
      id: i.id,
      name: i.name,
      baseUnit: i.baseUnit,
      purchaseUnit: i.purchaseUnit,
      purchaseToBase: i.purchaseToBase,
      qtyOnHandBase: i.qtyOnHandBase,
      costPerBaseCentavos: i.costPerBaseCentavos,
      reorderThresholdBase: i.reorderThresholdBase,
      supplier: i.supplier,
      sheetWidth: i.sheetWidth,
      sheetHeight: i.sheetHeight,
      sheetUnit: i.sheetUnit,
      onHand,
      threshold,
      low,
      pct,
    };
  });

  const needsRestockCount = rows.filter((i) => i.low).length;
  const okCount = rows.filter((i) => !i.low).length;

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Stock</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Ingredients</h1>
        <p className="muted max-w-xl text-sm leading-6">
          Compact list — tap a row to restock, deduct, or run sheet-cut math for papers. Example: a
          10×30 sheet used in quarters yields 4 pieces; pick a bread to see how many loaves fit.
        </p>
      </header>

      <AdminIngredientsPanel
        filter={filter}
        ingredients={rows}
        products={products}
        needsRestockCount={needsRestockCount}
        okCount={okCount}
        totalCount={rows.length}
      />
    </div>
  );
}
