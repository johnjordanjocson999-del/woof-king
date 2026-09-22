import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { saveRecipe, recordProduction } from "@/app/actions/ops";
import { formatPesoShort } from "@/lib/money";
import { cn } from "@/lib/cn";
import { productImageStyle } from "@/lib/product-image";
import { Card, Chip, Eyebrow, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { BakeTimer } from "@/components/bake-timer";

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: focusId } = await searchParams;
  const [products, ingredients] = await Promise.all([
    db.product.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      include: { recipe: { include: { lines: { orderBy: { position: "asc" } } } } },
    }),
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);

  const focus = products.find((p) => p.id === focusId) ?? products[0] ?? null;
  const lines =
    focus?.recipe?.lines && focus.recipe.lines.length > 0
      ? focus.recipe.lines
      : [
          {
            id: "new",
            ingredientId: ingredients[0]?.id ?? "",
            qty: "",
            unit: "g",
            kind: "ingredient",
          },
        ];

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Baking</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Recipes</h1>
        <p className="muted max-w-xl text-sm leading-6">
          Pick a product, set its ingredient lines, then record a bake. Stock only moves when you
          record production — not when a customer orders.
        </p>
      </header>

      {!focus ? (
        <Notice tone="warn" title="No products yet">
          Add a product under Catalog first, then come back to write its recipe.
        </Notice>
      ) : (
        <>
          <section className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-display text-xl">Products</h2>
              <p className="faint text-xs">{products.length} on the shelf</p>
            </div>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <ul className="flex min-w-min gap-2">
                {products.map((product) => {
                  const active = product.id === focus.id;
                  return (
                    <li key={product.id} className="shrink-0">
                      <Link
                        href={`/admin/recipes?product=${product.id}`}
                        className={cn(
                          "grid w-[7.5rem] gap-2 rounded-[var(--radius-md)] border p-2 transition-colors",
                          active
                            ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--surface-2)_72%,var(--ember)_16%)]"
                            : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <div className="photo ratio-11 overflow-hidden rounded-[calc(var(--radius-md)-4px)]">
                          {product.imagePath ? (
                            <Image
                              src={product.imagePath}
                              alt=""
                              fill
                              sizes="120px"
                              className="object-cover"
                              style={productImageStyle(product)}
                            />
                          ) : (
                            <div className="grid h-full place-items-center bg-[var(--surface-2)] text-[0.65rem] text-[var(--faint)]">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="grid gap-0.5 px-0.5">
                          <span className="line-clamp-2 font-display text-sm leading-tight">
                            {product.name}
                          </span>
                          <span className="faint text-[0.65rem]">
                            {product.recipe ? "Has recipe" : "Needs recipe"}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <Card className="grid gap-6 p-5">
            <div className="grid gap-4 sm:grid-cols-[6.5rem_1fr] sm:items-center">
              <div className="photo ratio-11 overflow-hidden rounded-[var(--radius-md)]">
                {focus.imagePath ? (
                  <Image
                    src={focus.imagePath}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                    style={productImageStyle(focus)}
                  />
                ) : null}
              </div>
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl leading-tight">{focus.name}</h2>
                  {focus.recipe ? (
                    <Chip tone="sage" dot>
                      recipe saved
                    </Chip>
                  ) : (
                    <Chip tone="ember" dot>
                      no recipe
                    </Chip>
                  )}
                </div>
                <p className="muted text-sm">
                  {formatPesoShort(focus.priceCentavos)} / {focus.sellingUnit}
                  {focus.counterStock > 0 ? ` · ${focus.counterStock} on counter` : ""}
                </p>
              </div>
            </div>

            <form action={saveRecipe} className="grid gap-5">
              <input type="hidden" name="productId" value={focus.id} />

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Yield (pieces)" required>
                  <input
                    name="yieldPieces"
                    type="number"
                    min={1}
                    defaultValue={focus.recipe?.yieldPieces ?? 1}
                    required
                  />
                </Field>
                <Field label="Oven minutes">
                  <input
                    name="ovenMinutes"
                    type="number"
                    min={0}
                    defaultValue={focus.recipe?.ovenMinutes ?? 0}
                  />
                </Field>
                <Field label="Labour for batch (₱)">
                  <input
                    name="labor"
                    defaultValue={
                      focus.recipe ? (focus.recipe.laborCentavos / 100).toFixed(2) : "0"
                    }
                  />
                </Field>
              </div>

              <Field label="Instructions">
                <textarea
                  name="instructions"
                  rows={3}
                  defaultValue={focus.recipe?.instructions ?? ""}
                  placeholder="Mix, rest, bake…"
                />
              </Field>

              <div className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">Ingredient lines</p>
                  <p className="faint text-xs">Qty uses the ingredient&apos;s unit (g, ml, piece)</p>
                </div>

                <div className="grid gap-2">
                  <div className="hidden gap-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--faint)] sm:grid sm:grid-cols-[1.4fr_5.5rem_5.5rem_7.5rem]">
                    <span>Ingredient</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Type</span>
                  </div>

                  {lines.map((line, index) => (
                    <div
                      key={`${line.id}-${index}`}
                      className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3 sm:grid-cols-[1.4fr_5.5rem_5.5rem_7.5rem] sm:border-0 sm:bg-transparent sm:p-0"
                    >
                      <select name="lineIngredientId" defaultValue={line.ingredientId}>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                      <input name="lineQty" defaultValue={line.qty} placeholder="qty" />
                      <input name="lineUnit" defaultValue={line.unit} placeholder="g" />
                      <select name="lineKind" defaultValue={line.kind}>
                        <option value="ingredient">ingredient</option>
                        <option value="packaging">packaging</option>
                      </select>
                    </div>
                  ))}

                  {[0, 1].map((n) => (
                    <div
                      key={`blank-${n}`}
                      className="grid gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] p-3 sm:grid-cols-[1.4fr_5.5rem_5.5rem_7.5rem] sm:border-0 sm:p-0"
                    >
                      <select name="lineIngredientId" defaultValue="">
                        <option value="">— add line —</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                      <input name="lineQty" placeholder="qty" />
                      <input name="lineUnit" placeholder="g" defaultValue="g" />
                      <select name="lineKind" defaultValue="ingredient">
                        <option value="ingredient">ingredient</option>
                        <option value="packaging">packaging</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <SubmitButton>Save recipe</SubmitButton>
            </form>
          </Card>

          <Card className="grid gap-6 p-5">
            <div className="grid gap-1">
              <h2 className="font-display text-xl">Record a bake</h2>
              <p className="muted text-sm leading-6">
                Deducts ingredients for {focus.name} and adds finished pieces to the counter.
              </p>
            </div>

            <BakeTimer
              productName={focus.name}
              defaultMinutes={focus.recipe?.ovenMinutes ?? 0}
            />

            <form action={recordProduction} className="grid gap-4">
              <input type="hidden" name="productId" value={focus.id} />
              <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
                <Field label="Batches" hint="1 = one full recipe yield" required>
                  <input name="batches" defaultValue="1" required />
                </Field>
                <Field label="Waste pieces">
                  <input name="wastePieces" type="number" min={0} defaultValue={0} />
                </Field>
                <Field label="Notes">
                  <input name="notes" placeholder="Optional" />
                </Field>
              </div>
              <SubmitButton variant="solid">Deduct ingredients & add to counter</SubmitButton>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
