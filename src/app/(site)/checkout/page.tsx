import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getActiveMenu, ordersOpen } from "@/domain/menu";
import { listAvailabilitySlots } from "@/domain/availability";
import { readCart } from "@/lib/cart";
import { isBasketPayable, resolveBasket } from "@/domain/basket";
import { flatDeliveryFeeCentavos } from "@/domain/delivery-fee";
import { computeLoyaltyQuote } from "@/domain/loyalty";
import { resolveOnlinePaymentOptions } from "@/domain/payment-options";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyVat, formatPeso } from "@/lib/money";
import { vatOf } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import {
  composeCustomerAddress,
  mergeAddressLists,
  readSavedAddresses,
  type SavedAddress,
} from "@/lib/saved-addresses";
import { BasketLines, BasketTotals } from "@/components/basket-lines";
import { CheckoutForm } from "@/components/checkout-form";
import { Card, Eyebrow, Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const now = new Date();
  const [settings, menu, cart, user, availabilitySlots] = await Promise.all([
    getSettings(),
    getActiveMenu(now),
    readCart(),
    currentUser(),
    listAvailabilitySlots({ from: now, onlyActive: true }),
  ]);
  const basket = resolveBasket(cart, menu, settings);
  const open = ordersOpen(menu, now);

  if (!isBasketPayable(basket)) redirect("/basket");
  if (!open || !menu) redirect("/basket");

  const paymentOptions = await resolveOnlinePaymentOptions(settings);
  const deliveryFeeCentavos = flatDeliveryFeeCentavos(settings);

  const memberCustomer = user
    ? await db.customer.findUnique({ where: { userId: user.id } })
    : null;
  const cookiePlaces = await readSavedAddresses();
  const customerPlace = memberCustomer
    ? composeCustomerAddress(memberCustomer)
    : null;
  const fromCustomer: SavedAddress[] = customerPlace
    ? [
        {
          id: "customer-default",
          address: customerPlace.address,
          instructions: customerPlace.instructions,
          favorite: true,
          lastUsedAt: Date.now(),
          label: "Saved on your account",
        },
      ]
    : [];
  const savedAddresses = mergeAddressLists(cookiePlaces, fromCustomer);
  const defaultPlace = savedAddresses.find((p) => p.favorite) ?? savedAddresses[0];

  const cartProductQty = basket.lines.reduce((s, l) => s + l.qty, 0);
  const productSubtotal = basket.lines.reduce((s, l) => s + l.lineTotalCentavos, 0);
  const loyalty = computeLoyaltyQuote({
    settings,
    customer: memberCustomer,
    cartProductQty,
    productSubtotalCentavos: productSubtotal,
    pickupDate: menu.pickupDate,
  });
  const vat = vatOf(settings);
  const afterDiscount = Math.max(0, productSubtotal - loyalty.discountCentavos);
  const applied = applyVat(afterDiscount, vat.mode, vat.rateBps);

  return (
    <div className="shell grid gap-8 py-8 md:gap-10 md:py-16">
      <header className="grid gap-3">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="text-[2.35rem] leading-[1] md:text-[3.4rem]">Almost yours</h1>
        <p className="muted text-sm leading-6">
          Orders close {formatDateTime(menu.cutoffAt)}. Pick a free pickup or delivery day on the
          calendar. Payment is taken in full now.
          {!user && settings.loyaltyEnabled ? (
            <>
              {" "}
              <Link href="/login?mode=signup" className="link-underline">
                Create an account
              </Link>{" "}
              for member discounts and cashback.
            </>
          ) : null}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-12">
        <Card className="order-1 grid gap-5 p-5 lg:order-2 lg:sticky lg:top-24 lg:gap-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Order summary</h2>
            <span className="font-display text-xl lg:hidden">{formatPeso(applied.total)}</span>
          </div>
          <BasketLines basket={basket} compact />
          <BasketTotals
            basket={basket}
            discountCentavos={loyalty.discountCentavos}
            loyaltyLabels={loyalty.labels}
            adjustedTotalCentavos={applied.total}
            adjustedVatCentavos={applied.vat}
          />
          {!user && settings.loyaltyEnabled ? (
            <Notice tone="info" title="Member perks">
              Sign in to unlock volume discounts, streak rewards, and cashback on every ₱100.
            </Notice>
          ) : loyalty.discountCentavos > 0 ? (
            <Notice tone="success" title="Member savings applied">
              {loyalty.labels.join(" · ")}
              {loyalty.cashbackEarnedCentavos > 0
                ? ` · You’ll earn ${formatPeso(loyalty.cashbackEarnedCentavos)} cashback when this order is paid.`
                : ""}
            </Notice>
          ) : null}
          <Notice tone="info">
            Delivery adds a flat {formatPeso(deliveryFeeCentavos)} to your total. Pay on the next
            screen via QR scan or manual transfer.
          </Notice>
          <Link href="/basket" className="link-underline text-sm">
            Edit basket
          </Link>
        </Card>

        <div className="order-2 lg:order-1">
          <CheckoutForm
            availabilitySlots={availabilitySlots}
            paymentOptions={paymentOptions}
            deliveryNote={settings.deliveryNote}
            basketTotalCentavos={applied.total}
            deliveryFeeCentavos={deliveryFeeCentavos}
            loyaltyDiscountCentavos={loyalty.discountCentavos}
            loyaltyLabels={loyalty.labels}
            defaultName={user?.name}
            defaultPhone={user?.phone ?? undefined}
            defaultEmail={user?.email}
            savedAddresses={savedAddresses}
            defaultDeliveryAddress={defaultPlace?.address ?? ""}
            defaultDeliveryInstructions={defaultPlace?.instructions ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
