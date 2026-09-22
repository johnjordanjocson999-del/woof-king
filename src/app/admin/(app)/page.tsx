import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings, scheduleOf } from "@/lib/settings";
import { getActiveMenu, ordersOpen } from "@/domain/menu";
import { buildRestockList } from "@/domain/inventory";
import { formatPeso } from "@/lib/money";
import { bakeCycleFor, countdown, formatDateTime, formatDay } from "@/lib/time";
import { Card, Chip, Eyebrow, Notice } from "@/components/ui";
import { confirmManualPaymentForm } from "@/app/actions/payments";

export default async function AdminTodayPage() {
  const now = new Date();
  const settings = await getSettings();
  const menu = await getActiveMenu(now);
  const cycle = menu
    ? {
        orderOpensAt: menu.orderOpensAt,
        cutoffAt: menu.cutoffAt,
        prepDates: menu.prepDates.split(","),
        pickupDate: menu.pickupDate,
      }
    : bakeCycleFor(now, scheduleOf(settings));
  const open = ordersOpen(menu, now);
  const remaining = countdown(cycle.cutoffAt, now);

  const [pendingPayments, dueOrders, below, restock] = await Promise.all([
    db.payment.findMany({
      where: { status: "submitted", provider: "manual" },
      include: { order: { select: { code: true, contactName: true } } },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    db.order.findMany({
      where: {
        paymentStatus: "paid",
        fulfillmentStatus: { in: ["confirmed", "preparing", "ready", "coordinating"] },
      },
      orderBy: { pickupDate: "asc" },
      take: 10,
      include: { items: { select: { id: true, quantity: true, nameSnapshot: true } } },
    }),
    db.ingredient.findMany({
      orderBy: { name: "asc" },
      take: 40,
    }),
    buildRestockList(menu?.id),
  ]);

  const lowStock = below.filter(
    (i) => Number(i.qtyOnHandBase) < Number(i.reorderThresholdBase),
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Today</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">Bakehouse desk</h1>
          <p className="muted text-sm">
            {open
              ? `Ordering open · closes in ${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`
              : `Ordering closed · next pickup ${formatDay(cycle.pickupDate)}`}
          </p>
        </div>
        <Link href="/admin/print/delivery-card" className="btn btn-solid btn-sm">
          Print box QR cards
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Cutoff" value={formatDateTime(cycle.cutoffAt)} />
        <Stat label="Pickup" value={formatDay(cycle.pickupDate)} />
        <Stat
          label="This week items"
          value={menu ? String(menu.items.length) : "—"}
        />
      </div>

      {pendingPayments.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl">GCash proofs to confirm</h2>
          <ul className="grid gap-2">
            {pendingPayments.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="grid gap-0.5 text-sm">
                    <span className="font-semibold">{p.order.code}</span>
                    <span className="muted">
                      {p.order.contactName} · {formatPeso(p.amountCentavos)}
                    </span>
                    {p.proofPath ? (
                      <a href={p.proofPath} target="_blank" rel="noreferrer" className="link-underline">
                        View screenshot
                      </a>
                    ) : null}
                  </div>
                  <form action={confirmManualPaymentForm}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Confirm paid
                    </button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Open orders</h2>
          <Link href="/admin/orders" prefetch={false} className="link-underline text-sm">
            All orders
          </Link>
        </div>
        {dueOrders.length === 0 ? (
          <Notice tone="info">No paid open orders.</Notice>
        ) : (
          <ul className="grid gap-2">
            {dueOrders.map((o) => (
              <li key={o.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <span className="font-semibold">{o.code}</span>
                    <span className="muted">
                      {" "}
                      · {o.contactName} · {formatDay(o.pickupDate)}
                    </span>
                  </div>
                  <Chip tone={o.fulfillment === "delivery" ? "ember" : "sage"} dot>
                    {o.fulfillment} · {o.fulfillmentStatus}
                  </Chip>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Restock needed</h2>
          <Link href="/admin/reports" className="link-underline text-sm">
            Full report
          </Link>
        </div>
        {restock.length === 0 && lowStock.length === 0 ? (
          <Notice tone="success">Stock looks healthy for now.</Notice>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="num">On hand</th>
                  <th className="num">Buy</th>
                </tr>
              </thead>
              <tbody>
                {restock.map((r) => (
                  <tr key={r.ingredientId}>
                    <td>
                      {r.name}
                      {r.belowThreshold ? (
                        <Chip tone="danger" className="ml-2">
                          low
                        </Chip>
                      ) : null}
                    </td>
                    <td className="num">
                      {Number(r.qtyOnHandBase).toFixed(0)} {r.baseUnit}
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
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="grid gap-1 p-4">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-xl leading-tight">{value}</span>
    </Card>
  );
}
