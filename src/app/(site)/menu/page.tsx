import type { Metadata } from "next";
import Link from "next/link";
import { getActiveMenu, ordersOpen } from "@/domain/menu";
import { deliveryWindowsForMenu } from "@/domain/delivery";
import { readCart } from "@/lib/cart";
import { countdown, formatDateTime, formatDay, formatClock } from "@/lib/time";
import { Eyebrow, EmptyState, Notice } from "@/components/ui";
import { CountdownRing } from "@/components/countdown-ring";
import { BakeWeek } from "@/components/bake-week";
import { OrderWindowStrip } from "@/components/order-window-strip";
import { MenuProductFeed } from "@/components/menu-product-feed";

export const metadata: Metadata = {
  title: "This week's table",
  description: "The three to five things we are baking this week. Order by Thursday.",
};

export default async function MenuPage() {
  const now = new Date();
  const [menu, cart] = await Promise.all([getActiveMenu(now), readCart()]);
  const open = ordersOpen(menu, now);
  const inBasket = new Map(cart.lines.map((line) => [line.menuItemId, line.qty]));

  if (!menu) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="No rotation published yet"
          action={
            <Link href="/" className="btn btn-ghost btn-sm">
              Back to the bakehouse
            </Link>
          }
        >
          We publish the coming week&apos;s menu a few days before ordering opens. Follow along on
          Instagram and we will tell you the moment it is live.
        </EmptyState>
      </div>
    );
  }

  const cycle = {
    orderOpensAt: menu.orderOpensAt,
    cutoffAt: menu.cutoffAt,
    prepDates: menu.prepDates.split(",").filter(Boolean),
    pickupDate: menu.pickupDate,
  };
  const remaining = countdown(cycle.cutoffAt, now);
  const deliveryWindows = await deliveryWindowsForMenu(menu.id, menu.pickupDate);

  return (
    <div className="shell grid gap-8 py-8 md:gap-16 md:py-16">
      <header className="grid gap-6 md:grid-cols-[1.4fr_auto] md:items-center md:gap-10">
        <div className="grid gap-3 md:gap-5">
          <Eyebrow>{menu.title}</Eyebrow>
          <h1 className="text-[2.35rem] leading-[0.98] md:text-[4rem]">
            {menu.items.length} things,
            <br />
            baked once.
          </h1>
          <p className="muted max-w-xl text-[0.98rem] leading-7 md:text-[1.02rem]">
            Everything here is mixed and shaped after ordering closes, so the amount we bake is the
            amount that was bought. Collection is {formatDay(menu.pickupDate)}.
          </p>
        </div>
        <div className="hidden justify-self-end md:block">
          <CountdownRing
            cutoffMs={cycle.cutoffAt.getTime()}
            openedMs={cycle.orderOpensAt.getTime()}
            cutoffLabel={
              menu.cutoffEnabled
                ? formatDateTime(cycle.cutoffAt)
                : "when the bakery closes orders"
            }
            size={186}
            initial={{
              days: remaining.days,
              hours: remaining.hours,
              minutes: remaining.minutes,
              seconds: remaining.seconds,
              expired: remaining.expired || !open,
            }}
          />
        </div>
      </header>

      <OrderWindowStrip
        open={open}
        cutoffLabel={
          menu.cutoffEnabled
            ? formatDateTime(menu.cutoffAt)
            : "when the bakery closes orders"
        }
        collectLabel={formatDay(menu.pickupDate)}
        className="md:hidden"
      />

      {/* Desktop: Bake Week above the table (original placement) */}
      <div className="hidden md:block">
        <BakeWeek cycle={cycle} now={now} />
      </div>

      {!open ? (
        <Notice tone="warn" title="Ordering for this week has closed">
          The flour for {formatDay(menu.pickupDate)} is already committed. The next rotation opens
          right after collection, so check back Sunday evening.
        </Notice>
      ) : null}

      {menu.items.length === 0 ? (
        <EmptyState title="This week&apos;s items are being set">
          The rotation is published but no products are listed yet. Check back shortly, or ask the
          bakery to finish the menu in admin.
        </EmptyState>
      ) : (
        <MenuProductFeed
          items={menu.items}
          inBasket={inBasket}
          closed={!open}
        />
      )}

      {deliveryWindows.length > 0 ? (
        <section className="grid gap-4 border-t border-[var(--line)] pt-8">
          <div className="grid gap-2">
            <Eyebrow>Delivery</Eyebrow>
            <h2 className="font-display text-2xl">Available windows</h2>
            <p className="muted text-sm leading-6">
              Choose one at checkout. A flat ₱50 delivery fee is added to your total.
            </p>
          </div>
          <ul className="grid gap-0 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {deliveryWindows.map((window) => {
              const left = Math.max(0, window.capacity - window.booked);
              return (
                <li
                  key={window.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-3.5"
                >
                  <div className="grid gap-0.5">
                    <p className="text-sm font-semibold">{window.label}</p>
                    <p className="muted text-sm leading-5">
                      {formatDay(window.date)} · {formatClock(window.start)} –{" "}
                      {formatClock(window.end)}
                    </p>
                  </div>
                  <p className="faint text-xs">{left > 0 ? `${left} spots left` : "Full"}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="faint max-w-2xl text-xs leading-6">
        All items are made in a kitchen that handles wheat, dairy, eggs and nuts, so we cannot
        promise any product is free of traces. Allergens listed under each item are the ones we put
        in deliberately.
      </p>
    </div>
  );
}
