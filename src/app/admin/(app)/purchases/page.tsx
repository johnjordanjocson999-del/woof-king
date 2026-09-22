import { db } from "@/lib/db";
import { logPurchase } from "@/app/actions/ops";
import { formatPeso } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Card, Eyebrow, Field } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminPurchasesPage() {
  const [ingredients, purchases] = await Promise.all([
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
    db.purchase.findMany({
      orderBy: { purchasedAt: "desc" },
      take: 20,
      include: { items: { include: { ingredient: true } } },
    }),
  ]);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Buying</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Purchases</h1>
        <p className="muted text-sm">
          Log what the receipt says — 1 sack, 2 L, 500 g. We convert to base and update the moving
          average cost.
        </p>
      </header>

      <Card className="grid gap-4 p-5">
        <h2 className="font-display text-xl">Log a purchase</h2>
        <form action={logPurchase} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier">
              <input name="supplier" />
            </Field>
            <Field label="Notes">
              <input name="notes" />
            </Field>
          </div>
          <ul className="grid gap-3">
            {ingredients.map((ing) => (
              <li
                key={ing.id}
                className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 sm:grid-cols-[auto_1fr_5rem_5rem_6rem] sm:items-end"
              >
                <label className="flex items-center gap-2 text-sm sm:pb-2">
                  <input type="checkbox" name="ingredientId" value={ing.id} />
                  {ing.name}
                </label>
                <span className="faint text-xs sm:pb-2">
                  base {ing.baseUnit} · buy as {ing.purchaseUnit}
                </span>
                <Field label="Qty">
                  <input name={`qty_${ing.id}`} placeholder="1" />
                </Field>
                <Field label="Unit">
                  <input name={`unit_${ing.id}`} defaultValue={ing.purchaseUnit.split(" ")[0]} />
                </Field>
                <Field label="Line ₱">
                  <input name={`cost_${ing.id}`} placeholder="0" />
                </Field>
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:sticky md:bottom-0 md:z-20 md:-mx-5 md:-mb-5 md:bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] md:backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="muted text-xs leading-5">
                Tick items, fill qty and ₱, then save — stays here while you scroll.
              </p>
              <SubmitButton>Record purchase</SubmitButton>
            </div>
          </div>
        </form>
      </Card>

      <section className="grid gap-3">
        <h2 className="font-display text-xl">Recent</h2>
        {purchases.map((p) => (
          <Card key={p.id} className="grid gap-2 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span>{p.supplier || "Supplier n/a"}</span>
              <span className="price">{formatPeso(p.totalCentavos)}</span>
            </div>
            <p className="faint text-xs">{formatDateTime(p.purchasedAt)}</p>
            <ul className="muted text-xs">
              {p.items.map((item) => (
                <li key={item.id}>
                  {item.qty} {item.unit} {item.ingredient.name} → {item.qtyBase}{" "}
                  {item.ingredient.baseUnit}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
    </div>
  );
}
