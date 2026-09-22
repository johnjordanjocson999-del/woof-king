import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatClock, formatDay, formatDateTime } from "@/lib/time";
import { OrderReceipt, type ReceiptData } from "@/components/order-receipt";
import { Chip, Eyebrow, Notice } from "@/components/ui";
import { RememberOrder } from "@/components/remember-order";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Receipt ${code}` };
}

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ token?: string; justSubmitted?: string }>;
}) {
  const { code } = await params;
  const { token, justSubmitted } = await searchParams;

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
          Open the link from your confirmation message to see this receipt.
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
  const submitted = order.paymentStatus === "submitted";

  const fulfillmentLabel =
    order.fulfillment === "pickup"
      ? `Pickup ${formatDay(order.pickupDate)}${
          order.pickupSlot
            ? ` · ${formatClock(order.pickupSlot.start)}–${formatClock(order.pickupSlot.end)}`
            : ""
        }`
      : order.deliveryWindow
        ? `Delivery ${formatDay(order.deliveryWindow.date)} · ${formatClock(order.deliveryWindow.start)}–${formatClock(order.deliveryWindow.end)}`
        : "Delivery (window to be confirmed)";

  const receipt: ReceiptData = {
    code: order.code,
    bakeryName: settings.bakeryName,
    tagline: settings.tagline,
    paymentStatus: order.paymentStatus,
    fulfillmentLabel,
    collectFrom: order.fulfillment === "pickup" ? settings.pickupAddress : undefined,
    deliverTo:
      order.fulfillment === "delivery"
        ? [order.deliveryAddress, order.deliveryInstructions].filter(Boolean).join(" — ")
        : undefined,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      qty: item.quantity,
      lineTotalCentavos: item.unitPriceCentavos * item.quantity,
    })),
    deliveryFeeCentavos: order.deliveryFeeCentavos,
    discountCentavos: order.discountCentavos,
    loyaltyNote: order.loyaltyNote || undefined,
    totalCentavos: order.totalCentavos,
    paymentMethod: payment?.method || payment?.provider || undefined,
    referenceNote: payment?.referenceNote || undefined,
    placedLabel: formatDateTime(order.createdAt),
  };

  return (
    <div className="shell grid gap-10 py-10 md:gap-12 md:py-16">
      <RememberOrder code={order.code} token={token} />
      <header className="no-print grid justify-items-center gap-3 text-center md:gap-4">
        <Eyebrow>
          {justSubmitted === "1"
            ? "Submitted"
            : paid
              ? "Confirmed"
              : submitted
                ? "Under review"
                : "Your order"}
        </Eyebrow>
        <h1 className="max-w-2xl text-[2.35rem] leading-[1] md:text-[3.2rem]">
          {justSubmitted === "1"
            ? "Payment details sent"
            : paid
              ? "Order confirmed"
              : submitted
                ? "We’re checking your payment"
                : "Order status"}
        </h1>
        <p className="muted max-w-lg text-sm leading-6">
          {justSubmitted === "1"
            ? "Here’s a quick review of what you ordered. Save the receipt to your phone so you have it at pickup or delivery."
            : "Review your order below. Save the receipt as an image or PDF anytime."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Chip tone={paid ? "sage" : submitted ? "ember" : "neutral"} dot>
            {order.paymentStatus}
          </Chip>
          <Chip>{order.fulfillment}</Chip>
        </div>
      </header>

      {justSubmitted === "1" && submitted ? (
        <Notice tone="success" title="Got it — thanks" className="no-print">
          We received your reference
          {payment?.providerPaymentId ? (
            <>
              {" "}
              (<strong className="font-mono">{payment.providerPaymentId}</strong>)
            </>
          ) : null}
          . You’ll get confirmation once the bakery verifies the transfer.
        </Notice>
      ) : null}

      <OrderReceipt data={receipt} />

      <div className="no-print flex flex-wrap items-center justify-center gap-3 border-t border-[var(--line)] pt-8">
        {!paid && !submitted ? (
          <Link
            href={`/order/${order.code}?token=${order.accessToken}`}
            className="btn btn-primary"
          >
            Back to payment
          </Link>
        ) : (
          <Link
            href={`/order/${order.code}?token=${order.accessToken}`}
            className="btn btn-ghost"
          >
            View full order page
          </Link>
        )}
        <Link href="/menu" className="btn btn-ghost">
          Back to the table
        </Link>
        <Link href="/orders" className="btn btn-ghost">
          Look up later
        </Link>
      </div>
    </div>
  );
}
