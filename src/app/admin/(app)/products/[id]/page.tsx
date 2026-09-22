import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { productCostBreakdown } from "@/domain/costing";
import { manilaMonthKey } from "@/lib/time";
import { formatPeso, formatPesoShort } from "@/lib/money";
import { formatBase } from "@/lib/units";
import { ProductForm } from "@/components/product-form";
import { Card, Eyebrow } from "@/components/ui";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "new") {
    return (
      <div className="grid gap-8">
        <header className="grid gap-2">
          <Eyebrow>Catalog</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">New product</h1>
        </header>
        <ProductForm />
      </div>
    );
  }

  const [product, settings, overhead] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { recipe: { include: { lines: { include: { ingredient: true }, orderBy: { position: "asc" } } } } },
    }),
    getSettings(),
    db.overhead.findUnique({ where: { month: manilaMonthKey(new Date()) } }),
  ]);
  if (!product) notFound();

  const cost =
    product.recipe && product.recipe.lines.length > 0
      ? productCostBreakdown({
          recipe: product.recipe,
          lines: product.recipe.lines,
          sellingPrice: product.priceCentavos,
          estimatedFeeBps: settings.estimatedFeeBps,
          overhead,
        })
      : null;

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <Eyebrow>Catalog</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">{product.name}</h1>
        <Link href="/admin/products" className="link-underline text-sm">
          All products
        </Link>
      </header>

      <ProductForm product={product} />

      {cost ? (
        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Cost per {product.sellingUnit}</h2>
          <p className="muted text-xs leading-5">
            Ingredient usage is batch qty ÷ yield ({product.recipe!.yieldPieces} pieces). That is
            how one cupcake&apos;s flour is known: 480 g ÷ 24 = 20 g.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Per piece</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {cost.lines.map((line) => (
                  <tr key={line.ingredientId + line.kind}>
                    <td>
                      {line.name}
                      {line.kind === "packaging" ? " (pack)" : ""}
                    </td>
                    <td>{formatBase(line.qtyPerPieceBase, line.baseUnit)}</td>
                    <td className="num">{formatPeso(line.costPerPieceCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="muted">Ingredients</dt>
              <dd className="price">{formatPeso(cost.ingredientPerPiece)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Packaging</dt>
              <dd className="price">{formatPeso(cost.packagingPerPiece)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Labour</dt>
              <dd className="price">{formatPeso(cost.laborPerPiece)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Overhead share</dt>
              <dd className="price">{formatPeso(cost.overheadPerPiece)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Est. payment fee</dt>
              <dd className="price">{formatPeso(cost.estimatedFee)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Estimated cost</dt>
              <dd className="price font-semibold">{formatPeso(cost.estimatedCost)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Selling price</dt>
              <dd className="price">{formatPesoShort(cost.sellingPrice)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Est. margin</dt>
              <dd className="price font-semibold">
                {(cost.estimatedMargin * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
          <Link href={`/admin/recipes?product=${product.id}`} className="link-underline text-sm">
            Edit recipe
          </Link>
        </Card>
      ) : (
        <Card className="p-5 text-sm">
          <p className="muted">
            No recipe yet —{" "}
            <Link href={`/admin/recipes?product=${product.id}`} className="link-underline">
              add one
            </Link>{" "}
            to see per-piece costing.
          </p>
        </Card>
      )}
    </div>
  );
}
