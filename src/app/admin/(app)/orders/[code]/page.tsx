import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateOrderStatus, deleteOrder } from "@/app/actions/admin";
import { confirmPaymentForm, rejectPaymentForm } from "@/app/actions/payment-review";
import { formatPeso } from "@/lib/money";
import { formatClock, formatDateTime, formatDay } from "@/lib/time";
import { Card, Chip, Eyebrow, Notice } from "@/components/ui";
import { SubmitButton, ConfirmSubmit } from "@/components/form";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await db.order.findUnique({
    where: { code },
    include: {
      items: { include: { product: true } },
      pickupSlot: true,
      deliveryWindow: true,
      payments: { orderBy: { createdAt: "desc" } },
      customer: true,
      menu: true,
    },
  });
  if (!order) notFound();

  const latestPayment = order.payments[0] ?? null;
  const statuses = ["confirmed", "preparing", "ready", "coordinating", "completed", "cancelled"];

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Order</Eyebrow>
          <h1 className="text-[2.4rem] leading-[1]">{order.code}</h1>
          <p className="muted text-sm">
            Placed {formatDateTime(order.createdAt)}
            {order.paidAt ? ` · paid ${formatDateTime(order.paidAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/payments?tab=review" className="btn btn-ghost btn-sm">
            Payment review
          </Link>
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            All orders
          </Link>
          <Link
            href={`/order/${order.code}?token=${order.accessToken}`}
            className="btn btn-solid btn-sm"
            target="_blank"
          >
            Customer page
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip tone={order.paymentStatus === "paid" ? "sage" : "ember"} dot>
          payment · {order.paymentStatus}
        </Chip>
        <Chip tone="neutral" dot>
          {order.fulfillmentStatus}
        </Chip>
        <Chip>{order.fulfillment}</Chip>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Customer</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="faint text-xs uppercase tracking-wide">Name</dt>
              <dd>{order.contactName}</dd>
            </div>
            <div>
              <dt className="faint text-xs uppercase tracking-wide">Phone</dt>
              <dd>
                <a href={`tel:${order.contactPhone.replace(/\s/g, "")}`} className="link-underline">
                  {order.contactPhone}
                </a>
              </dd>
            </div>
            {order.contactEmail ? (
              <div>
                <dt className="faint text-xs uppercase tracking-wide">Email</dt>
                <dd>
                  <a href={`mailto:${order.contactEmail}`} className="link-underline">
                    {order.contactEmail}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="faint text-xs uppercase tracking-wide">Collection / delivery</dt>
              <dd>
                {formatDay(order.pickupDate)}
                {order.pickupSlot
                  ? ` · ${order.pickupSlot.label} ${formatClock(order.pickupSlot.start)}`
                  : ""}
                {order.deliveryWindow
                  ? ` · ${order.deliveryWindow.label} ${formatDay(order.deliveryWindow.date)} ${formatClock(order.deliveryWindow.start)}–${formatClock(order.deliveryWindow.end)}`
                  : ""}
              </dd>
            </div>
            {order.fulfillment === "delivery" ? (
              <div>
                <dt className="faint text-xs uppercase tracking-wide">Address</dt>
                <dd className="leading-6">
                  {order.deliveryAddress || "—"}
                  {order.deliveryInstructions ? (
                    <>
                      <br />
                      <span className="muted text-xs">{order.deliveryInstructions}</span>
                    </>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {order.notes ? (
              <div>
                <dt className="faint text-xs uppercase tracking-wide">Notes</dt>
                <dd>{order.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="font-display text-xl">Items & total</h2>
          <ul className="grid gap-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 border-b border-[var(--line)] pb-2">
                <span>
                  {item.quantity}× {item.nameSnapshot}
                </span>
                <span className="price tnum">
                  {formatPeso(item.unitPriceCentavos * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="muted">Subtotal</dt>
              <dd className="price">{formatPeso(order.subtotalCentavos)}</dd>
            </div>
            {order.discountCentavos > 0 ? (
              <div className="flex justify-between">
                <dt className="muted">Discount</dt>
                <dd className="price text-[var(--success)]">−{formatPeso(order.discountCentavos)}</dd>
              </div>
            ) : null}
            {order.deliveryFeeCentavos > 0 ? (
              <div className="flex justify-between">
                <dt className="muted">Delivery</dt>
                <dd className="price">{formatPeso(order.deliveryFeeCentavos)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-[var(--line)] pt-2">
              <dt className="font-display text-lg">Total</dt>
              <dd className="font-display text-xl price">{formatPeso(order.totalCentavos)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl">Payment</h2>
          <Link href="/admin/payments?tab=review" className="link-underline text-sm">
            All payments to review
          </Link>
        </div>

        {order.payments.length === 0 ? (
          <Notice tone="warn">No payment record yet.</Notice>
        ) : (
          <ul className="grid gap-4">
            {order.payments.map((p) => (
              <li
                key={p.id}
                className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--line)] p-4 lg:grid-cols-[1fr_10rem]"
              >
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      tone={p.status === "paid" ? "sage" : p.status === "submitted" ? "ember" : "neutral"}
                      dot
                    >
                      {p.status}
                    </Chip>
                    <span className="muted">
                      {p.method || p.provider} · {formatPeso(p.amountCentavos)}
                    </span>
                  </div>
                  <p className="faint text-xs">
                    Created {formatDateTime(p.createdAt)}
                    {p.paidAt ? ` · paid ${formatDateTime(p.paidAt)}` : ""}
                  </p>
                  {p.providerPaymentId || p.referenceNote ? (
                    <p>
                      <span className="faint text-xs uppercase tracking-wide">Reference</span>
                      <br />
                      {p.providerPaymentId ? <strong>{p.providerPaymentId}</strong> : null}
                      {p.referenceNote ? (
                        <span className="muted text-sm">
                          {p.providerPaymentId ? " · " : ""}
                          {p.referenceNote}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {p.status === "submitted" || p.status === "pending" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <form action={confirmPaymentForm}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <SubmitButton small>Confirm paid</SubmitButton>
                      </form>
                      {p.status === "submitted" ? (
                        <form action={rejectPaymentForm} className="flex flex-wrap gap-2">
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input name="note" placeholder="Reason (optional)" />
                          <SubmitButton small variant="ghost">
                            Ask again
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {p.proofPath ? (
                  <a
                    href={p.proofPath}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white"
                  >
                    <Image src={p.proofPath} alt="Proof" fill sizes="(max-width: 640px) 90vw, 280px" className="object-contain p-1" />
                  </a>
                ) : (
                  <div className="grid aspect-square place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] text-xs text-[var(--faint)]">
                    No proof
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="font-display text-xl">Fulfillment</h2>
        <p className="muted text-sm">Current: {order.fulfillmentStatus}</p>
        <div className="flex flex-wrap gap-2">
          {statuses
            .filter((s) => s !== order.fulfillmentStatus)
            .map((status) => (
              <form
                key={status}
                action={async () => {
                  "use server";
                  await updateOrderStatus(order.id, status);
                }}
              >
                <SubmitButton small variant={status === "completed" ? "solid" : "ghost"}>
                  → {status}
                </SubmitButton>
              </form>
            ))}
        </div>
        <p className="muted text-xs leading-5">
          Moving to <strong>completed</strong> clears it from the active Orders board (still in
          Finished). Delete removes it forever.
        </p>
        <form action={deleteOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="returnTo" value="/admin/orders" />
          <ConfirmSubmit message={`Permanently delete order ${order.code}? This cannot be undone.`}>
            Delete order
          </ConfirmSubmit>
        </form>
      </Card>

      {latestPayment?.status === "submitted" ? (
        <Notice tone="warn" title="Waiting for your confirmation">
          Customer submitted payment details. Confirm above once the transfer looks correct.
        </Notice>
      ) : null}
    </div>
  );
}
