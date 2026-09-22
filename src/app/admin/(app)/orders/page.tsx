import { db } from "@/lib/db";
import Link from "next/link";
import { updateOrderStatusForm } from "@/app/actions/admin";
import { confirmManualPaymentForm } from "@/app/actions/payments";
import { formatPeso } from "@/lib/money";
import { formatDay, formatClock } from "@/lib/time";
import { Card, Chip, Eyebrow } from "@/components/ui";

const COLUMNS = [
  { id: "confirmed", title: "Confirmed" },
  { id: "preparing", title: "Preparing" },
  { id: "ready", title: "Ready" },
  { id: "coordinating", title: "Coordinate delivery" },
  { id: "completed", title: "Completed" },
] as const;

function StatusMove({ orderId, current }: { orderId: string; current: string }) {
  const options = COLUMNS.filter((c) => c.id !== current);
  return (
    <form action={updateOrderStatusForm} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="status"
        defaultValue={options[0]?.id}
        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-xs"
        aria-label="Move order to"
      >
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-solid btn-sm shrink-0">
        Move
      </button>
    </form>
  );
}

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: { in: ["paid", "submitted", "pending"] },
      kind: "preorder",
      fulfillmentStatus: { in: ["confirmed", "preparing", "ready", "coordinating", "completed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 36,
    include: {
      items: { select: { id: true, quantity: true, nameSnapshot: true } },
      pickupSlot: { select: { start: true } },
      deliveryWindow: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, proofPath: true },
      },
    },
  });

  const completedCap = 6;
  let completedSeen = 0;
  const boardOrders = orders.filter((o) => {
    if (o.fulfillmentStatus !== "completed") return true;
    if (completedSeen >= completedCap) return false;
    completedSeen += 1;
    return true;
  });

  const byStatus = Object.fromEntries(
    COLUMNS.map((c) => [c.id, boardOrders.filter((o) => o.fulfillmentStatus === c.id)]),
  ) as Record<(typeof COLUMNS)[number]["id"], typeof boardOrders>;

  const awaitingPay = boardOrders.filter(
    (o) => o.paymentStatus === "submitted" || o.paymentStatus === "pending",
  );

  return (
    <div className="grid gap-6 md:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Fulfillment</Eyebrow>
          <h1 className="text-[2rem] leading-[1] md:text-[2.2rem]">Orders</h1>
        </div>
        <Link href="/admin/payments?tab=review" prefetch={false} className="btn btn-ghost btn-sm">
          Review payments
        </Link>
      </header>

      {awaitingPay.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-lg">Awaiting payment</h2>
          {awaitingPay.map((o) => {
            const pay = o.payments[0];
            return (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <Link
                    href={`/admin/orders/${o.code}`}
                    prefetch={false}
                    className="font-semibold link-underline"
                  >
                    {o.code}
                  </Link>{" "}
                  · {o.contactName} · {formatPeso(o.totalCentavos)}
                  {pay?.proofPath ? (
                    <>
                      {" · "}
                      <a href={pay.proofPath} className="link-underline" target="_blank" rel="noreferrer">
                        proof
                      </a>
                    </>
                  ) : null}
                </div>
                {pay && pay.status === "submitted" ? (
                  <form action={confirmManualPaymentForm}>
                    <input type="hidden" name="paymentId" value={pay.id} />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Confirm paid
                    </button>
                  </form>
                ) : (
                  <Chip tone="ember">{o.paymentStatus}</Chip>
                )}
              </Card>
            );
          })}
        </section>
      ) : null}

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:pb-0">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className="grid w-[min(82vw,19rem)] shrink-0 content-start gap-2 lg:w-auto"
          >
            <h2 className="eyebrow flex items-baseline justify-between gap-2">
              <span>{col.title}</span>
              <span className="tnum text-[var(--faint)]">{byStatus[col.id].length}</span>
            </h2>
            <ul className="grid gap-2">
              {byStatus[col.id].map((o) => (
                <li key={o.id}>
                  <Card className="admin-order-card grid gap-2 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/orders/${o.code}`}
                        prefetch={false}
                        className="font-semibold hover:text-[var(--ember-glow)]"
                      >
                        {o.code}
                      </Link>
                      <Chip tone={o.fulfillment === "delivery" ? "ember" : "sage"}>
                        {o.fulfillment}
                      </Chip>
                    </div>
                    <p className="muted text-xs leading-5">
                      {o.contactName}
                      <br />
                      <a href={`tel:${o.contactPhone.replace(/\s/g, "")}`} className="link-underline">
                        {o.contactPhone}
                      </a>
                      <br />
                      {formatDay(o.pickupDate)}
                      {o.pickupSlot ? ` · ${formatClock(o.pickupSlot.start)}` : ""}
                      {o.deliveryWindow
                        ? ` · handoff ${formatDay(o.deliveryWindow.date)} ${formatClock(o.deliveryWindow.start)}–${formatClock(o.deliveryWindow.end)}`
                        : ""}
                    </p>
                    {o.fulfillment === "delivery" ? (
                      <p className="text-xs leading-5 text-[var(--wheat)]">
                        {o.deliveryWindow
                          ? `${o.deliveryWindow.label}${o.deliveryFeeCentavos > 0 ? ` · delivery ${formatPeso(o.deliveryFeeCentavos)}` : ""}`
                          : "Message to coordinate delivery"}
                        <br />
                        {o.deliveryAddress}
                      </p>
                    ) : null}
                    <ul className="faint text-xs">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          {i.quantity}× {i.nameSnapshot}
                        </li>
                      ))}
                    </ul>
                    <StatusMove orderId={o.id} current={col.id} />
                  </Card>
                </li>
              ))}
              {byStatus[col.id].length === 0 ? (
                <li className="muted rounded-[var(--radius-md)] border border-dashed border-[var(--line)] px-3 py-6 text-center text-xs">
                  None
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
