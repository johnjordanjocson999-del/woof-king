import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getActiveMenu, ordersOpen } from "@/domain/menu";
import { readCart } from "@/lib/cart";
import { isBasketPayable, resolveBasket } from "@/domain/basket";
import { formatDateTime, formatDay } from "@/lib/time";
import { formatPeso } from "@/lib/money";
import { BasketLines, BasketTotals, BasketWarnings } from "@/components/basket-lines";
import { Card, EmptyState, Eyebrow, Notice } from "@/components/ui";
import { MobileStickyBar } from "@/components/mobile-sticky-bar";

export const metadata: Metadata = { title: "Your basket" };

export default async function BasketPage() {
  const now = new Date();
  const [settings, menu, cart] = await Promise.all([getSettings(), getActiveMenu(now), readCart()]);
  const basket = resolveBasket(cart, menu, settings);
  const open = ordersOpen(menu, now);
  const payable = isBasketPayable(basket) && open;

  if (basket.lines.length === 0) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Your basket is empty"
          action={
            <Link href="/menu" className="btn btn-primary btn-sm">
              See this week&apos;s table
            </Link>
          }
        >
          Pick from the three to five things we are baking this week.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="shell grid gap-8 py-8 pb-40 md:gap-10 md:py-16 md:pb-16">
      <header className="grid gap-3">
        <Eyebrow>Basket</Eyebrow>
        <h1 className="text-[2.35rem] leading-[1] md:text-[3.4rem]">Check it over</h1>
        {menu ? (
          <p className="muted text-sm leading-6">
            Ordering closes {formatDateTime(menu.cutoffAt)}. Collection {formatDay(menu.pickupDate)}.
          </p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-12">
        <div className="grid gap-6">
          <BasketWarnings basket={basket} />
          {!open ? (
            <Notice tone="danger" title="Ordering has closed">
              We cannot take this order for {menu ? formatDay(menu.pickupDate) : "this week"} any
              more. Your basket is kept, so you can bring it back when the next rotation opens.
            </Notice>
          ) : null}
          <BasketLines basket={basket} />
        </div>

        <Card className="hidden gap-6 p-5 lg:sticky lg:top-24 lg:grid">
          <BasketTotals basket={basket} />

          <div className="grid gap-2">
            <Link
              href="/checkout"
              aria-disabled={!payable}
              className={`btn btn-primary w-full ${payable ? "" : "pointer-events-none opacity-45"}`}
            >
              Checkout <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/menu" className="btn btn-ghost w-full">
              Keep looking
            </Link>
          </div>

          <p className="faint text-xs leading-5">
            Payment is taken in full at checkout. Delivery adds a flat ₱50 to your order total.
          </p>
        </Card>
      </div>

      <MobileStickyBar>
        <div className="mx-auto grid max-w-lg gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="muted text-sm">
              {basket.totals.itemCount} {basket.totals.itemCount === 1 ? "item" : "items"}
            </span>
            <span className="font-display text-xl">{formatPeso(basket.totals.totalCentavos)}</span>
          </div>
          <Link
            href="/checkout"
            aria-disabled={!payable}
            className={`btn btn-primary w-full ${payable ? "" : "pointer-events-none opacity-45"}`}
          >
            Checkout <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </MobileStickyBar>
    </div>
  );
}
