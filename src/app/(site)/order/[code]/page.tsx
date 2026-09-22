import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPeso } from "@/lib/money";
import { formatClock, formatDay, formatDateTime } from "@/lib/time";
import { WaxSeal } from "@/components/brand-marks";
import {
  CashPaymentPanel,
  PaymentChannelPanel,
} from "@/components/payment-channel-panel";
import {
  getPaymentOptionBySlug,
  legacyPaymentOptions,
  toCheckoutOption,
} from "@/domain/payment-options";
import { Card, Chip, Eyebrow, Notice } from "@/components/ui";
import { RememberOrder } from "@/components/remember-order";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Order ${code}` };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ token?: string; pay?: string; status?: string; channel?: string }>;
}) {
  const { code } = await params;
  const { token, pay, status, channel } = await searchParams;

  const order = await db.order.findUnique({
    where: { code },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      pickupSlot: true,
      deliveryWindow: true,
    },
  });
  if (!order) notFound();
  if (!token || token !== order.accessToken) {
    return (
      <div className="shell py-20">
        <Notice tone="danger" title="Private link required">
          Open the link from your confirmation message to see this order. For privacy, order pages
          are not public.
        </Notice>
        <Link href="/orders" className="btn btn-ghost mt-6">
          Look up an order
        </Link>
      </div>
    );
  }

  const settings = await getSettings();
  const payment = order.payments[0];
  const paid = order.paymentStatus === "paid";
  const methodSlug = channel || payment?.method || "vybe";
  const isCash = pay === "cash" || payment?.provider === "cash" || methodSlug === "cash";

  let paymentOption = null;
  if (!isCash) {
    const row = await getPaymentOptionBySlug(methodSlug);
    paymentOption = row
      ? toCheckoutOption(row)
      : legacyPaymentOptions(settings).find((o) => o.slug === methodSlug) ?? null;
  }

  return (
    <div className="shell grid gap-12 py-12 md:py-16">
      <RememberOrder code={order.code} token={token} />
      <header className="grid justify-items-center gap-6 text-center">
        <Eyebrow>{paid ? "Confirmed" : "Awaiting payment"}</Eyebrow>
        <h1 className="text-[2.4rem] leading-[1] md:text-[3.2rem]">
          {paid ? "Order confirmed" : "Pay to confirm your order"}
        </h1>
        <WaxSeal
          code={order.code}
          paid={paid}
          caption={
            paid
              ? "Your confirmation code. Show this seal (or just the code) at pickup or to the rider."
              : "Your order code — use this as your payment reference when you transfer."
          }
        />
      </header>

      {status === "success" && !paid ? (
        <Notice tone="info" title="Payment processing">
          If you paid just now, confirmation can take a few seconds. Refresh this page shortly —
          a success redirect alone does not mark the order paid.
        </Notice>
      ) : null}
      {status === "cancel" ? (
        <Notice tone="warn" title="Payment cancelled">
          Nothing was charged. You can try again below.
        </Notice>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="grid gap-5 p-5">
          <h2 className="font-display text-xl">Order details</h2>
          <dl className="grid gap-3 text-sm">
            <Row label="Status">
              <Chip tone={paid ? "sage" : "ember"} dot>
                {order.paymentStatus} · {order.fulfillmentStatus}
              </Chip>
            </Row>
            <Row label="Fulfillment">
              {order.fulfillment === "pickup"
                ? `Pickup ${formatDay(order.pickupDate)}${
                    order.pickupSlot
                      ? ` · ${formatClock(order.pickupSlot.start)}–${formatClock(order.pickupSlot.end)}`
                      : ""
                  }`
                : order.deliveryWindow
                  ? `Delivery ${formatDay(order.deliveryWindow.date)} · ${formatClock(order.deliveryWindow.start)}–${formatClock(order.deliveryWindow.end)}`
                  : "Delivery (window to be confirmed)"}
            </Row>
            {order.fulfillment === "delivery" ? (
              <Row label="Deliver to">
                <span className="leading-6">
                  {order.deliveryAddress}
                  {order.deliveryInstructions ? (
                    <>
                      <br />
                      <span className="muted">{order.deliveryInstructions}</span>
                    </>
                  ) : null}
                </span>
              </Row>
            ) : (
              <Row label="Collect from">{settings.pickupAddress}</Row>
            )}
            <Row label="Contact">
              {order.contactName}
              <br />
              {order.contactPhone}
            </Row>
          </dl>

          <ul className="grid gap-2 border-t border-[var(--line)] pt-4 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.quantity}× {item.nameSnapshot}
                </span>
                <span className="price">{formatPeso(item.unitPriceCentavos * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.deliveryFeeCentavos > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="muted">Delivery</span>
              <span className="price">{formatPeso(order.deliveryFeeCentavos)}</span>
            </div>
          ) : null}
          {order.discountCentavos > 0 ? (
            <div className="grid gap-1 text-sm">
              <div className="flex justify-between">
                <span className="muted">Member savings</span>
                <span className="price text-[var(--success)]">
                  −{formatPeso(order.discountCentavos)}
                </span>
              </div>
              {order.loyaltyNote ? (
                <p className="muted text-[0.7rem] leading-4">{order.loyaltyNote}</p>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-between border-t border-[var(--line)] pt-3">
            <span className="font-display text-lg">Total</span>
            <span className="font-display price text-xl">{formatPeso(order.totalCentavos)}</span>
          </div>
        </Card>

        <Card className="grid content-start gap-5 p-5">
          <h2 className="font-display text-xl">Payment</h2>
          {paid ? (
            <Notice tone="success" title="Paid in full">
              Paid {order.paidAt ? formatDateTime(order.paidAt) : ""}. Order{" "}
              <strong>{order.code}</strong> is confirmed.
              {order.fulfillment === "delivery"
                ? " We will message your phone to coordinate delivery."
                : " Bring this page or your order code on Sunday."}
              <span className="mt-3 block">
                <Link
                  href={`/order/${order.code}/status?token=${order.accessToken}`}
                  className="btn btn-primary btn-sm"
                >
                  View receipt &amp; save
                </Link>
              </span>
            </Notice>
          ) : order.paymentStatus === "submitted" ? (
            <Notice tone="info" title="Payment under review">
              We have your transfer details and will confirm soon.
              <span className="mt-3 block">
                <Link
                  href={`/order/${order.code}/status?token=${order.accessToken}`}
                  className="btn btn-primary btn-sm"
                >
                  View status &amp; receipt
                </Link>
              </span>
            </Notice>
          ) : isCash ? (
            <CashPaymentPanel
              orderCode={order.code}
              amountCentavos={order.totalCentavos}
              instructions={
                paymentOption?.instructions ||
                "Pay cash at the bakery when you collect your order."
              }
            />
          ) : payment?.provider === "manual" || pay === "manual" ? (
            paymentOption ? (
              <PaymentChannelPanel
                orderId={order.id}
                accessToken={order.accessToken}
                orderCode={order.code}
                amountCentavos={order.totalCentavos}
                option={paymentOption}
                paymentStatus={order.paymentStatus}
              />
            ) : (
              <Notice tone="warn" title="Payment method unavailable">
                Contact the bakery with your order code to finish paying.
              </Notice>
            )
          ) : payment?.checkoutUrl ? (
            <a href={payment.checkoutUrl} className="btn btn-primary">
              Continue to PayMongo
            </a>
          ) : payment?.isMock ? (
            <Link
              href={`/pay/mock?paymentId=${payment.id}&token=${order.accessToken}`}
              className="btn btn-primary"
            >
              Complete demo payment
            </Link>
          ) : (
            <Notice tone="info">Payment is being prepared. Refresh in a moment.</Notice>
          )}

          <p className="faint text-xs leading-5">{settings.cancellationPol}</p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr]">
      <dt className="faint text-xs font-semibold uppercase tracking-[0.1em]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
