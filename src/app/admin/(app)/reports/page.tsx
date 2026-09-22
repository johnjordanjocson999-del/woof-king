import { db } from "@/lib/db";
import { buildRestockList } from "@/domain/inventory";
import { getActiveMenu } from "@/domain/menu";
import { saveOverhead } from "@/app/actions/ops";
import { formatPeso } from "@/lib/money";
import { formatBase } from "@/lib/units";
import {
  WEEKDAYS_SHORT,
  addDays,
  formatDay,
  formatMonthKey,
  manilaDateKey,
  manilaMonthKey,
  manilaParts,
  manilaStartOfDay,
} from "@/lib/time";
import { Card, Chip, Eyebrow, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ReportPdfButton } from "@/components/report-pdf-button";
import {
  DailyRevenueChart,
  ExpenseDonut,
  MaterialsChart,
  MoneyCompareChart,
} from "@/components/report-charts";

export default async function AdminReportsPage() {
  const now = new Date();
  const monthKey = manilaMonthKey(now);
  const weekStart = addDays(manilaStartOfDay(now), -6);
  const monthStart = new Date(`${monthKey}-01T00:00:00+08:00`);

  const [menu, restock, overhead, weekOrders, monthOrders, purchases, ingredients, movements] =
    await Promise.all([
      getActiveMenu(now),
      buildRestockList(),
      db.overhead.findUnique({ where: { month: monthKey } }),
      db.order.findMany({
        where: { paymentStatus: "paid", paidAt: { gte: weekStart } },
      }),
      db.order.findMany({
        where: { paymentStatus: "paid", paidAt: { gte: monthStart } },
      }),
      db.purchase.findMany({
        where: { purchasedAt: { gte: monthStart } },
      }),
      db.ingredient.findMany({ orderBy: { name: "asc" } }),
      db.stockMovement.findMany({
        where: { at: { gte: weekStart }, type: "production_consumption" },
        include: { ingredient: true },
        take: 300,
      }),
    ]);

  const weekSales = weekOrders.reduce((s, o) => s + o.totalCentavos, 0);
  const monthSales = monthOrders.reduce((s, o) => s + o.totalCentavos, 0);
  const purchasesTotal = purchases.reduce((s, p) => s + p.totalCentavos, 0);
  const overheadParts = {
    electricity: overhead?.electricityCentavos ?? 0,
    gas: overhead?.gasCentavos ?? 0,
    water: overhead?.waterCentavos ?? 0,
    rent: overhead?.rentCentavos ?? 0,
    other: overhead?.otherCentavos ?? 0,
  };
  const overheadTotal = Object.values(overheadParts).reduce((a, b) => a + b, 0);
  const monthExpenses = purchasesTotal + overheadTotal;
  const profit = monthSales - monthExpenses;
  const lowStock = ingredients.filter(
    (i) => Number(i.qtyOnHandBase) < Number(i.reorderThresholdBase),
  );

  const dailyPoints = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const key = manilaDateKey(day);
    const valueCentavos = weekOrders
      .filter((o) => o.paidAt && manilaDateKey(o.paidAt) === key)
      .reduce((s, o) => s + o.totalCentavos, 0);
    return {
      label: WEEKDAYS_SHORT[manilaParts(day).weekday],
      valueCentavos,
    };
  });

  const consumption = new Map<string, { name: string; qty: number; unit: string }>();
  for (const m of movements) {
    if (!m.ingredient || !m.ingredientId) continue;
    const prev = consumption.get(m.ingredientId) ?? {
      name: m.ingredient.name,
      qty: 0,
      unit: m.ingredient.baseUnit,
    };
    prev.qty += Math.abs(Number(m.qtyBase));
    consumption.set(m.ingredientId, prev);
  }

  const materialBars = ingredients
    .map((i) => ({
      name: i.name,
      onHand: Number(i.qtyOnHandBase),
      threshold: Number(i.reorderThresholdBase),
      unit: i.baseUnit,
    }))
    .sort((a, b) => a.onHand / Math.max(a.threshold, 1) - b.onHand / Math.max(b.threshold, 1))
    .slice(0, 10);

  const expenseSlices = [
    { label: "Purchases", valueCentavos: purchasesTotal, color: "var(--ember)" },
    { label: "Electricity", valueCentavos: overheadParts.electricity, color: "#F0DCA4" },
    { label: "Gas", valueCentavos: overheadParts.gas, color: "#A3612C" },
    { label: "Water", valueCentavos: overheadParts.water, color: "#3E86B5" },
    { label: "Rent", valueCentavos: overheadParts.rent, color: "#7E8A5F" },
    { label: "Other", valueCentavos: overheadParts.other, color: "#CBAA7C" },
  ];

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Numbers</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">Financial report</h1>
          <p className="muted max-w-xl text-sm leading-6">
            Money in (sales), money out (purchases + bills), and what is left in the pantry — all
            from real orders and stock moves.
          </p>
        </div>
        <ReportPdfButton href="/admin/report-pdf" label="Download PDF" />
      </header>

      {/* Snapshot */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Snapshot
          label="This month · revenue"
          value={formatPeso(monthSales)}
          meta={`${monthOrders.length} paid orders`}
          tone="ember"
        />
        <Snapshot
          label="This month · expenses"
          value={formatPeso(monthExpenses)}
          meta={`Purchases ${formatPeso(purchasesTotal)} · Bills ${formatPeso(overheadTotal)}`}
          tone="muted"
        />
        <Snapshot
          label="Profit / loss"
          value={formatPeso(profit)}
          meta={profit >= 0 ? "Revenue minus expenses" : "Spending is ahead of sales"}
          tone={profit >= 0 ? "sage" : "danger"}
        />
        <Snapshot
          label="Materials low"
          value={String(lowStock.length)}
          meta={
            menu
              ? `Menu pickup ${formatDay(menu.pickupDate)} · ${menu.items.length} items`
              : "No published menu"
          }
          tone={lowStock.length > 0 ? "danger" : "sage"}
        />
      </section>

      {lowStock.length > 0 ? (
        <Notice tone="warn" title="Restock soon">
          {lowStock
            .slice(0, 4)
            .map((i) => i.name)
            .join(", ")}
          {lowStock.length > 4 ? ` +${lowStock.length - 4} more` : ""} are below their reorder line.
        </Notice>
      ) : null}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-5 p-5">
          <div className="grid gap-1">
            <h2 className="font-display text-xl">Revenue vs expenses</h2>
            <p className="muted text-xs leading-5">
              {formatMonthKey(monthKey)} at a glance — longer bar means more pesos.
            </p>
          </div>
          <MoneyCompareChart
            bars={[
              { label: "Revenue", value: monthSales, tone: "ember" },
              { label: "Purchases", value: purchasesTotal, tone: "muted" },
              { label: "Bills (overhead)", value: overheadTotal, tone: "danger" },
              {
                label: profit >= 0 ? "Profit" : "Loss",
                value: Math.abs(profit),
                tone: profit >= 0 ? "sage" : "danger",
              },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm">
            <div>
              <p className="faint text-xs uppercase tracking-wide">7-day sales</p>
              <p className="font-display text-lg price">{formatPeso(weekSales)}</p>
            </div>
            <div>
              <p className="faint text-xs uppercase tracking-wide">7-day orders</p>
              <p className="font-display text-lg">{weekOrders.length}</p>
            </div>
          </div>
        </Card>

        <Card className="grid gap-5 p-5">
          <div className="grid gap-1">
            <h2 className="font-display text-xl">Where money went</h2>
            <p className="muted text-xs leading-5">Purchases and monthly bills for {formatMonthKey(monthKey)}.</p>
          </div>
          <ExpenseDonut slices={expenseSlices} />
        </Card>
      </div>

      <Card className="grid gap-5 p-5">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">Sales · last 7 days</h2>
          <p className="muted text-xs leading-5">Paid orders only, by day.</p>
        </div>
        <DailyRevenueChart points={dailyPoints} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-5 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="font-display text-xl">Materials left</h2>
              <p className="muted text-xs leading-5">
                White tick = reorder line. Red bar means buy soon.
              </p>
            </div>
            {lowStock.length > 0 ? (
              <Chip tone="danger" dot>
                {lowStock.length} low
              </Chip>
            ) : (
              <Chip tone="sage" dot>
                stock ok
              </Chip>
            )}
          </div>
          <MaterialsChart items={materialBars} />
        </Card>

        <Card className="grid gap-5 p-5">
          <div className="grid gap-1">
            <h2 className="font-display text-xl">Used in the kitchen (7 days)</h2>
            <p className="muted text-xs leading-5">From recorded production batches.</p>
          </div>
          {[...consumption.values()].length === 0 ? (
            <p className="muted text-sm">No production recorded this week.</p>
          ) : (
            <ul className="grid gap-2">
              {[...consumption.values()]
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 8)
                .map((c) => (
                  <li
                    key={c.name}
                    className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2 text-sm last:border-0"
                  >
                    <span>{c.name}</span>
                    <span className="muted tnum">
                      {formatBase(String(c.qty), c.unit as "g" | "ml" | "piece")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="grid gap-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="font-display text-xl">Restock list</h2>
            <p className="muted text-xs leading-5">
              What to buy so this week&apos;s paid orders can be baked.
            </p>
          </div>
          <ReportPdfButton href="/admin/report-pdf" label="Download PDF" />
        </div>
        {restock.length === 0 ? (
          <p className="muted text-sm">Nothing to restock right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem]">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="num">On hand</th>
                  <th className="num">Needed</th>
                  <th className="num">Buy</th>
                </tr>
              </thead>
              <tbody>
                {restock.map((r) => (
                  <tr key={r.ingredientId}>
                    <td className="font-medium">{r.name}</td>
                    <td className="num">
                      {formatBase(r.qtyOnHandBase, r.baseUnit as "g" | "ml" | "piece")}
                    </td>
                    <td className="num">
                      {formatBase(r.qtyNeededBase, r.baseUnit as "g" | "ml" | "piece")}
                    </td>
                    <td className="num">
                      {Number(r.buyPurchaseUnits) > 0
                        ? `${r.buyPurchaseUnits} ${r.purchaseUnit}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="grid gap-5 p-5">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">Monthly bills — {formatMonthKey(monthKey)}</h2>
          <p className="muted text-xs leading-5">
            Enter rent, utilities, and other costs. These feed the expense chart and PDF.
          </p>
        </div>
        <form action={saveOverhead} className="grid gap-3 sm:grid-cols-3 sm:items-start">
          <input type="hidden" name="month" value={monthKey} />
          <Field label="Electricity ₱">
            <input
              name="electricity"
              defaultValue={overhead ? (overhead.electricityCentavos / 100).toFixed(2) : "0"}
            />
          </Field>
          <Field label="Gas ₱">
            <input
              name="gas"
              defaultValue={overhead ? (overhead.gasCentavos / 100).toFixed(2) : "0"}
            />
          </Field>
          <Field label="Water ₱">
            <input
              name="water"
              defaultValue={overhead ? (overhead.waterCentavos / 100).toFixed(2) : "0"}
            />
          </Field>
          <Field label="Rent ₱">
            <input
              name="rent"
              defaultValue={overhead ? (overhead.rentCentavos / 100).toFixed(2) : "0"}
            />
          </Field>
          <Field label="Other ₱">
            <input
              name="other"
              defaultValue={overhead ? (overhead.otherCentavos / 100).toFixed(2) : "0"}
            />
          </Field>
          <Field label="Allocate by">
            <select name="allocationBasis" defaultValue={overhead?.allocationBasis ?? "units"}>
              <option value="units">Units sold</option>
              <option value="hours">Oven hours</option>
            </select>
          </Field>
          <Field label="Expected units">
            <input name="expectedUnits" type="number" defaultValue={overhead?.expectedUnits ?? 0} />
          </Field>
          <Field label="Expected hours">
            <input name="expectedHours" type="number" defaultValue={overhead?.expectedHours ?? 0} />
          </Field>
          <Field label="Notes" className="sm:col-span-3">
            <input name="notes" defaultValue={overhead?.notes ?? ""} />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton>Save bills</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Snapshot({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone: "ember" | "sage" | "danger" | "muted";
}) {
  const accent =
    tone === "ember"
      ? "border-[color-mix(in_oklab,var(--ember)_45%,var(--line))]"
      : tone === "sage"
        ? "border-[color-mix(in_oklab,var(--success)_45%,var(--line))]"
        : tone === "danger"
          ? "border-[color-mix(in_oklab,var(--danger)_45%,var(--line))]"
          : "border-[var(--line)]";
  const valueColor =
    tone === "ember"
      ? "text-[var(--ember-glow)]"
      : tone === "sage"
        ? "text-[var(--success)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "";

  return (
    <Card className={`grid gap-2 p-4 ${accent}`}>
      <span className="eyebrow">{label}</span>
      <span className={`font-display text-2xl leading-none price ${valueColor}`}>{value}</span>
      <span className="faint text-xs leading-5">{meta}</span>
    </Card>
  );
}
