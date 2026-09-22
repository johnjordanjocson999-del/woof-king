import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { buildRestockList } from "@/domain/inventory";
import { getActiveMenu } from "@/domain/menu";
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
import { BRAND } from "@/lib/brand";
import { PrintReportAuto } from "@/components/print-report-auto";

export const metadata = { title: "Financial report PDF" };

/** Standalone print sheet — outside the admin chrome so PDF export stays clean. */
export default async function AdminReportPdfPage() {
  await requireStaff();
  const data = await loadReportData();

  return (
    <div className="report-print min-h-dvh bg-[var(--paper-solid)] text-[var(--on-ember)]">
      <PrintReportAuto />
      <div className="no-print mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-8 pt-6">
        <a href="/admin/reports" className="btn btn-ghost btn-sm">
          Back to reports
        </a>
        <p className="muted text-xs">
          Print dialog opens automatically — choose <strong>Save as PDF</strong>.
        </p>
      </div>
      <div className="mx-auto max-w-3xl px-8 py-10 print:px-6 print:py-6">
        <header className="mb-8 grid gap-2 border-b border-black/15 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember-deep)]">
            {BRAND.name} · Financial report
          </p>
          <h1 className="font-display text-3xl leading-none text-[var(--on-ember)]">
            {formatMonthKey(data.monthKey)}
          </h1>
          <p className="text-sm text-black/60">
            Printed {formatDay(data.now)} · Figures from paid orders, purchases, and overhead
          </p>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Revenue (month)" value={formatPeso(data.monthSales)} />
          <Stat label="Expenses (month)" value={formatPeso(data.monthExpenses)} />
          <Stat label="Profit / loss" value={formatPeso(data.profit)} warn={data.profit < 0} />
          <Stat label="Paid orders" value={String(data.monthOrderCount)} />
        </section>

        <section className="mb-8 grid gap-2">
          <h2 className="font-display text-xl">Expense breakdown</h2>
          <table className="w-full text-sm">
            <tbody>
              {data.expenseRows.map((row) => (
                <tr key={row.label} className="border-b border-black/10">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatPeso(row.value)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold">Total expenses</td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatPeso(data.monthExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-8 grid gap-2">
          <h2 className="font-display text-xl">Materials to restock</h2>
          {data.restock.length === 0 ? (
            <p className="text-sm text-black/60">Nothing below threshold right now.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/20 text-left text-xs uppercase tracking-wide text-black/50">
                  <th className="py-2">Ingredient</th>
                  <th className="py-2 text-right">On hand</th>
                  <th className="py-2 text-right">Buy</th>
                </tr>
              </thead>
              <tbody>
                {data.restock.map((r) => (
                  <tr key={r.ingredientId} className="border-b border-black/10">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatBase(r.qtyOnHandBase, r.baseUnit as "g" | "ml" | "piece")}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {Number(r.buyPurchaseUnits) > 0
                        ? `${r.buyPurchaseUnits} ${r.purchaseUnit}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-4 grid gap-2">
          <h2 className="font-display text-xl">Last 7 days sales</h2>
          <table className="w-full text-sm">
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.key} className="border-b border-black/10">
                  <td className="py-2">
                    {d.weekday} {d.key.slice(5)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatPeso(d.valueCentavos)}</td>
                  <td className="py-2 text-right text-black/50">{d.orders} orders</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-10 text-xs text-black/45">
          Active menu pickup: {data.menuLabel}. This report is for bakery staff only.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/70 p-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-black/45">{label}</p>
      <p className={`mt-1 font-display text-xl leading-none ${warn ? "text-red-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}

async function loadReportData() {
  const now = new Date();
  const monthKey = manilaMonthKey(now);
  const weekStart = addDays(manilaStartOfDay(now), -6);
  const monthStart = new Date(`${monthKey}-01T00:00:00+08:00`);

  const [menu, restock, overhead, weekOrders, monthOrders, purchases, ingredients] =
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
    ]);

  const monthSales = monthOrders.reduce((s, o) => s + o.totalCentavos, 0);
  const purchasesTotal = purchases.reduce((s, p) => s + p.totalCentavos, 0);
  const overheadTotal = overhead
    ? overhead.electricityCentavos +
      overhead.gasCentavos +
      overhead.waterCentavos +
      overhead.rentCentavos +
      overhead.otherCentavos +
      overhead.laborCentavos
    : 0;
  const monthExpenses = purchasesTotal + overheadTotal;
  const profit = monthSales - monthExpenses;

  const expenseRows = [
    { label: "Ingredient purchases", value: purchasesTotal },
    { label: "Electricity", value: overhead?.electricityCentavos ?? 0 },
    { label: "Gas", value: overhead?.gasCentavos ?? 0 },
    { label: "Water", value: overhead?.waterCentavos ?? 0 },
    { label: "Rent", value: overhead?.rentCentavos ?? 0 },
    { label: "Other overhead", value: overhead?.otherCentavos ?? 0 },
  ].filter((r) => r.value > 0 || r.label === "Ingredient purchases");

  const daily = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const key = manilaDateKey(day);
    const dayOrders = weekOrders.filter((o) => o.paidAt && manilaDateKey(o.paidAt) === key);
    return {
      key,
      weekday: WEEKDAYS_SHORT[manilaParts(day).weekday],
      valueCentavos: dayOrders.reduce((s, o) => s + o.totalCentavos, 0),
      orders: dayOrders.length,
    };
  });

  return {
    now,
    monthKey,
    monthSales,
    monthExpenses,
    profit,
    monthOrderCount: monthOrders.length,
    expenseRows,
    restock,
    daily,
    menuLabel: menu ? formatDay(menu.pickupDate) : "none",
    ingredientsCount: ingredients.length,
  };
}
