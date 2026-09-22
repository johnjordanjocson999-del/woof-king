import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { formatPesoShort } from "@/lib/money";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { ButtonLink } from "@/components/ui";

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: { recipe: true },
  });

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Catalog</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">Products</h1>
        </div>
        <ButtonLink href="/admin/products/new" small>
          Add product
        </ButtonLink>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}`}>
              <Card className="grid grid-cols-[4.5rem_1fr] gap-3 p-3 transition-colors hover:border-[var(--ember)]">
                <div className="photo ratio-11">
                  {p.imagePath ? (
                    <Image src={p.imagePath} alt="" fill sizes="72px" />
                  ) : null}
                </div>
                <div className="grid content-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg leading-tight">{p.name}</span>
                    {p.archived ? <Chip tone="danger">archived</Chip> : null}
                    {p.featured ? <Chip tone="ember">featured</Chip> : null}
                  </div>
                  <span className="muted text-xs">
                    {formatPesoShort(p.priceCentavos)} / {p.sellingUnit}
                    {p.recipe ? " · has recipe" : " · no recipe"}
                    {p.counterStock > 0 ? ` · ${p.counterStock} on counter` : ""}
                  </span>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
