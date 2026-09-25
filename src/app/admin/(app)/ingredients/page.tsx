import { db } from "@/lib/db";
import { upsertIngredient, quickRestockIngredient, adjustIngredientStock } from "@/app/actions/ops";
import { formatBase, BASE_UNITS } from "@/lib/units";
import { Card, Chip, Eyebrow, Field, EmptyState, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminIngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const ingredients = await db.ingredient.findMany({ orderBy: { name: "asc" } });

  const withStatus = ingredients.map((i) => {
    const onHand = Number(i.qtyOnHandBase);
    const threshold = Number(i.reorderThresholdBase);
    const low = threshold > 0 && onHand < threshold;
    const pct =
      threshold > 0 ? Math.min(100, Math.round((onHand / Math.max(threshold, 1)) * 100)) : 100;
    return { ...i, onHand, threshold, low, pct };
  });

  const needsRestock = withStatus.filter((i) => i.low);
  const stockedOk = withStatus.filter((i) => !i.low);
  const filter = view === "low" ? "low" : view === "ok" ? "ok" : "all";
  const shown =
    filter === "low" ? needsRestock : filter === "ok" ? stockedOk : withStatus;

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Stock</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Ingredients</h1>
        <p className="muted max-w-xl text-sm leading-6">
          See what is low, restock or deduct in one step, and edit how you buy each item. For papers
          and liners, use base unit <strong>Pieces</strong> and name by size (e.g. Baking paper
          10×30, Round liner) so circle and rectangular loaves can each link their own sheet in
          Recipes.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total items" value={String(ingredients.length)} />
        <StatCard
          label="Need restock"
          value={String(needsRestock.length)}
          warn={needsRestock.length > 0}
        />
        <StatCard label="Stock OK" value={String(stockedOk.length)} />
      </div>

      {needsRestock.length > 0 ? (
        <Notice tone="warn" title={`${needsRestock.length} running low`}>
          Use <strong>Restock</strong> on a card — enter how many packs you bought and what you
          paid. Stock updates right away.
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stock filter">
        <FilterLink href="/admin/ingredients" active={filter === "all"} count={withStatus.length}>
          All
        </FilterLink>
        <FilterLink
          href="/admin/ingredients?view=low"
          active={filter === "low"}
          count={needsRestock.length}
        >
          Needs restock
        </FilterLink>
        <FilterLink
          href="/admin/ingredients?view=ok"
          active={filter === "ok"}
          count={stockedOk.length}
        >
          Stock OK
        </FilterLink>
      </div>

      {ingredients.length === 0 ? (
        <EmptyState title="No ingredients yet">Add flour, butter, and the rest below.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title={filter === "low" ? "Nothing needs restocking" : "No items here"}>
          Switch filter or add a new ingredient.
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {shown.map((i) => {
            const unit = i.baseUnit as "g" | "ml" | "piece";
            const purchaseHint = i.purchaseUnit || i.baseUnit;
            return (
              <li key={i.id}>
                <Card
                  className={`grid gap-4 p-4 sm:p-5 ${
                    i.low
                      ? "border-[color-mix(in_oklab,var(--danger)_50%,var(--line))]"
                      : ""
                  }`}
                >
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl leading-tight">{i.name}</h2>
                        {i.low ? (
                          <Chip tone="danger" dot>
                            restock
                          </Chip>
                        ) : (
                          <Chip tone="sage" dot>
                            ok
                          </Chip>
                        )}
                      </div>
                      <p className="muted text-xs leading-5">
                        Buy as <strong>{purchaseHint}</strong>
                        {i.supplier ? ` · ${i.supplier}` : ""}
                        {" · "}
                        {Number(i.costPerBaseCentavos) > 0
                          ? `₱${(Number(i.costPerBaseCentavos) / 100).toFixed(4)}/${i.baseUnit} avg`
                          : "No cost yet"}
                      </p>
                    </div>
                    <div className="grid text-right">
                      <span className="faint text-[0.65rem] uppercase tracking-wide">On hand</span>
                      <span className="font-display text-2xl leading-none tnum">
                        {formatBase(i.qtyOnHandBase, unit)}
                      </span>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="grid gap-1.5">
                    <div className="flex justify-between text-[0.7rem]">
                      <span className="faint">Stock level</span>
                      <span className="muted tnum">
                        Reorder under {formatBase(i.reorderThresholdBase, unit)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${Math.max(4, Math.min(100, i.pct))}%`,
                          background: i.low ? "var(--danger)" : "var(--success)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick restock — always open when low */}
                  <details className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)]" open={i.low}>
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[var(--ember)]">＋</span>
                        Restock {i.name}
                      </span>
                    </summary>
                    <form
                      action={quickRestockIngredient}
                      className="grid gap-3 border-t border-[var(--line)] px-4 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                    >
                      <input type="hidden" name="ingredientId" value={i.id} />
                      <Field label={`How many (${purchaseHint})`} required>
                        <input
                          name="qty"
                          type="number"
                          min={0.01}
                          step="any"
                          required
                          placeholder="e.g. 2"
                        />
                      </Field>
                      <Field label="What you paid (₱)" required>
                        <input name="cost" required placeholder="e.g. 850" />
                      </Field>
                      <Field label="Supplier">
                        <input
                          name="supplier"
                          defaultValue={i.supplier || ""}
                          placeholder="Optional"
                        />
                      </Field>
                      <SubmitButton small>Add to stock</SubmitButton>
                    </form>
                  </details>

                  {/* Use / deduct */}
                  <details className="rounded-[var(--radius-md)] border border-[var(--line)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[var(--danger)]">−</span>
                        Use / deduct {i.name}
                      </span>
                    </summary>
                    <form
                      action={adjustIngredientStock}
                      className="grid gap-3 border-t border-[var(--line)] px-4 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                    >
                      <input type="hidden" name="ingredientId" value={i.id} />
                      <input type="hidden" name="direction" value="deduct" />
                      <Field label={`How many (${i.baseUnit})`} required>
                        <input
                          name="qty"
                          type="number"
                          min={0.01}
                          step="any"
                          required
                          placeholder={unit === "piece" ? "e.g. 3 sheets" : "e.g. 100"}
                        />
                      </Field>
                      <Field label="Note" className="sm:col-span-2">
                        <input name="reason" placeholder="e.g. lined 6 round loaves" />
                      </Field>
                      <SubmitButton small variant="ghost">
                        Deduct from stock
                      </SubmitButton>
                    </form>
                  </details>

                  {/* Edit details */}
                  <details className="rounded-[var(--radius-md)] border border-[var(--line)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--muted)] [&::-webkit-details-marker]:hidden">
                      Edit details
                    </summary>
                    <form
                      action={upsertIngredient}
                      className="grid gap-3 border-t border-[var(--line)] px-4 py-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={i.id} />
                      <Field label="Name" required>
                        <input name="name" required defaultValue={i.name} />
                      </Field>
                      <Field label="Base unit">
                        <select name="baseUnit" defaultValue={i.baseUnit}>
                          {BASE_UNITS.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Buy as" hint='Label on the receipt, e.g. "kg" or "sack (25 kg)"'>
                        <input name="purchaseUnit" defaultValue={i.purchaseUnit} />
                      </Field>
                      <Field
                        label="One pack = how many base units"
                        hint={`e.g. 1 kg = 1000 ${i.baseUnit}`}
                      >
                        <input name="purchaseToBase" defaultValue={i.purchaseToBase} />
                      </Field>
                      <Field label={`Reorder when below (${i.baseUnit})`}>
                        <input
                          name="reorderThresholdBase"
                          defaultValue={i.reorderThresholdBase}
                        />
                      </Field>
                      <Field label="Usual supplier">
                        <input name="supplier" defaultValue={i.supplier} />
                      </Field>
                      <div className="sm:col-span-2">
                        <SubmitButton small variant="ghost">
                          Save changes
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">Add a new ingredient</h2>
          <p className="muted text-xs leading-5">
            Start with name and how you buy it. For papers/liners: base unit Pieces, name by size
            (e.g. Baking paper 10×30, Round liner), buy as pack, one pack = sheet count.
          </p>
        </div>
        <form action={upsertIngredient} className="grid gap-3 sm:grid-cols-2 sm:items-start">
          <Field label="Name" required>
            <input name="name" required placeholder="e.g. Bread flour" />
          </Field>
          <Field label="Base unit" hint="Stock is always counted in this unit">
            <select name="baseUnit" defaultValue="g">
              {BASE_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buy as" hint='What the store calls it — "kg", "sack", "L"…'>
            <input name="purchaseUnit" defaultValue="kg" />
          </Field>
          <Field label="One pack → base units" hint="1 kg flour = 1000 g">
            <input name="purchaseToBase" defaultValue="1000" />
          </Field>
          <Field label="Reorder when below (base units)">
            <input name="reorderThresholdBase" defaultValue="5000" />
          </Field>
          <Field label="Supplier">
            <input name="supplier" placeholder="Optional" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Add ingredient</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card className="grid gap-1 p-4">
      <span className="eyebrow">{label}</span>
      <span
        className={`font-display text-2xl leading-none ${warn ? "text-[var(--danger)]" : ""}`}
      >
        {value}
      </span>
    </Card>
  );
}

function FilterLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}>
      {children}
      <span className={`ml-2 tabular-nums ${active ? "opacity-90" : "muted"}`}>{count}</span>
    </a>
  );
}
