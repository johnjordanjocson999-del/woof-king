import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Phone, Truck } from "lucide-react";
import { unstable_cache } from "next/cache";
import { getSettings, scheduleOf } from "@/lib/settings";
import { getActiveMenu, ordersOpen } from "@/domain/menu";
import { deliveryWindowsForMenu } from "@/domain/delivery";
import { readCart } from "@/lib/cart";
import { bakeCycleFor, countdown, formatDateTime, formatDay, formatClock } from "@/lib/time";
import { db } from "@/lib/db";
import { ButtonLink, Chip, Eyebrow, SectionHead } from "@/components/ui";
import { CountdownRing } from "@/components/countdown-ring";
import { BakeWeek } from "@/components/bake-week";
import { ProductCard } from "@/components/product-card";
import { BrandLogo } from "@/components/brand-marks";
import { MobileHomePanel } from "@/components/mobile-home-panel";

const getFeaturedProducts = unstable_cache(
  async () =>
    db.product.findMany({
      where: { featured: true, archived: false },
      orderBy: { name: "asc" },
      take: 12,
      select: {
        id: true,
        slug: true,
        name: true,
        imagePath: true,
        focalX: true,
        focalY: true,
        imageZoom: true,
      },
    }),
  ["wk-featured-products"],
  { revalidate: 60, tags: ["menu"] },
);

const getActivePickupSlots = unstable_cache(
  async () =>
    db.pickupSlot.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
    }),
  ["wk-pickup-slots"],
  { revalidate: 120, tags: ["settings"] },
);

export default async function HomePage() {
  const now = new Date();
  const [settings, menu, cart, featured, slots] = await Promise.all([
    getSettings(),
    getActiveMenu(now),
    readCart(),
    getFeaturedProducts(),
    getActivePickupSlots(),
  ]);
  const cycle = menu
    ? {
        orderOpensAt: menu.orderOpensAt,
        cutoffAt: menu.cutoffAt,
        prepDates: menu.prepDates.split(",").filter(Boolean),
        pickupDate: menu.pickupDate,
      }
    : bakeCycleFor(now, scheduleOf(settings));

  const open = ordersOpen(menu, now);
  const remaining = countdown(cycle.cutoffAt, now);
  const inBasket = new Map(cart.lines.map((line) => [line.menuItemId, line.qty]));
  const deliveryWindows = menu
    ? await deliveryWindowsForMenu(menu.id, menu.pickupDate)
    : [];

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate flex min-h-[52svh] items-end overflow-hidden sm:min-h-[78svh] md:min-h-[86svh]">
        {settings.heroPath ? (
          <Image
            src={settings.heroPath}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-[72%_40%] sm:object-[68%_42%]"
          />
        ) : null}
        {/* Phone: bottom fade into page ink so the panel continues the hero */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--ink)_25%,transparent)_0%,color-mix(in_oklab,var(--ink)_45%,transparent)_45%,var(--ink)_100%)] md:hidden"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-[var(--ink)] via-[color-mix(in_oklab,var(--ink)_78%,transparent)] to-transparent md:block"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 hidden h-2/3 bg-gradient-to-t from-[var(--ink)] to-transparent md:block"
        />

        <div className="shell grid w-full gap-4 pb-8 pt-16 sm:gap-5 sm:pb-8 sm:pt-20 md:grid-cols-[1.5fr_auto] md:items-end md:gap-16 md:pb-20 md:pt-32">
          <div className="grid max-w-2xl gap-2.5 md:gap-6">
            <Eyebrow>{settings.tagline}</Eyebrow>
            <h1 className="text-[2.15rem] leading-[0.95] sm:text-[4.2rem] md:text-[5.2rem]">
              {settings.heroHeading}
            </h1>
            <p className="muted hidden max-w-xl text-[1.05rem] leading-7 sm:block">
              {settings.heroBody}
            </p>
            <p className="muted line-clamp-2 max-w-xl text-[0.9rem] leading-5 sm:hidden">
              {settings.heroBody}
            </p>

            <div className="mt-0.5 flex flex-wrap items-center gap-2.5 sm:mt-1 sm:gap-3">
              <ButtonLink href="/menu">
                {open ? "Order this week" : "See the menu"}
                <ArrowRight size={16} aria-hidden />
              </ButtonLink>
              {menu ? (
                <Chip tone="sage" dot>
                  Collect {formatDay(menu.pickupDate)}
                </Chip>
              ) : null}
            </div>
          </div>

          <div className="hidden justify-self-end md:block">
            <CountdownRing
              cutoffMs={cycle.cutoffAt.getTime()}
              openedMs={cycle.orderOpensAt.getTime()}
              cutoffLabel={
                menu?.cutoffEnabled === false
                  ? "when the bakery closes orders"
                  : formatDateTime(cycle.cutoffAt)
              }
              initial={{
                days: remaining.days,
                hours: remaining.hours,
                minutes: remaining.minutes,
                seconds: remaining.seconds,
                expired: remaining.expired || !open,
              }}
            />
          </div>
        </div>
      </section>

      {/* Phone-only: status, bake week, featured, story */}
      <MobileHomePanel
        open={open}
        cycle={cycle}
        now={now}
        cutoffLabel={
          menu?.cutoffEnabled === false
            ? "when the bakery closes orders"
            : formatDateTime(cycle.cutoffAt)
        }
        collectLabel={menu ? formatDay(menu.pickupDate) : formatDay(cycle.pickupDate)}
        announcement={settings.announcement}
        featured={featured}
        itemCount={menu?.items.length ?? 0}
        story={settings.story}
        heroPath={settings.heroPath}
      />

      {/* Desktop: Bake Week under hero (original placement) */}
      <section className="shell hidden pt-10 md:block">
        <BakeWeek cycle={cycle} now={now} />
      </section>

      {/* Desktop: full weekly table */}
      <section className="shell hidden gap-6 py-8 md:grid md:gap-10 md:py-16">
        {settings.announcement ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--line)] border-l-2 border-l-[var(--ember)] bg-[var(--surface)] px-4 py-3 text-sm leading-6">
            {settings.announcement}
          </p>
        ) : null}

        <SectionHead
          eyebrow={open ? "Ordering now" : "Ordering closed"}
          title="This week's table"
          description={
            menu
              ? `${menu.items.length} things, baked once. Order by ${formatDateTime(menu.cutoffAt)} for collection on ${formatDay(menu.pickupDate)}.`
              : "The next rotation has not been published yet. Check back in a day or two."
          }
          action={
            menu ? (
              <Link href="/menu" className="link-underline text-sm font-semibold">
                Full menu
              </Link>
            ) : null
          }
        />

        {menu && menu.items.length > 0 ? (
          <div className="menu-list">
            {menu.items.map((item, index) => (
              <ProductCard
                key={item.id}
                item={item}
                index={index}
                inBasket={inBasket.get(item.id) ?? 0}
                closed={!open}
                revealDelay={index * 90}
              />
            ))}
          </div>
        ) : (
          <p className="muted">Nothing is on the table this week yet.</p>
        )}
      </section>

      {/* Desktop-only below: how it works, story, visit */}
      <section className="shell hidden gap-10 py-10 md:grid md:py-16">
        <SectionHead eyebrow="How it works" title="Four steps, one week" />
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Choose",
              `Pick from the three to five things we are baking. Ordering closes ${formatDateTime(cycle.cutoffAt)}.`,
            ],
            [
              "Pay in full",
              "Card, GCash or QR Ph at checkout. Paying up front is how we know exactly how much flour to mix and waste almost none.",
            ],
            [
              "We bake",
              "Friday through Sunday, by hand, in small batches. Nothing is made before it is sold.",
            ],
            [
              "Collect",
              `Sunday at the slot you picked. Or leave a number and we will arrange a rider with you.`,
            ],
          ].map(([title, body], index) => (
            <li key={title} className="reveal grid gap-3" data-reveal-delay={index * 80}>
              <span className="font-display text-[2.4rem] leading-none text-[var(--line-strong)]">
                0{index + 1}
              </span>
              <h3 className="text-xl">{title}</h3>
              <p className="muted text-sm leading-6">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The single bright section on the site. After a long dark scroll the
          switch to warm paper lands like turning a page. */}
      <section id="story" className="paper-section mt-12 hidden py-16 md:block md:py-24">
        <div className="shell grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16">
          <div className="grid gap-5">
            <BrandLogo href={null} className="h-[140px] drop-shadow-none" />
            <Eyebrow>Our story</Eyebrow>
            <h2 className="text-[2.4rem] leading-[1.02] md:text-[3.2rem]">
              Better Bites.
              <br />
              Taste Woof King.
            </h2>
            <p className="muted whitespace-pre-line text-[1rem] leading-7">{settings.story}</p>
          </div>
          <div className="photo ratio-43 shadow-[0_30px_70px_-30px_rgba(28,21,18,0.5)]">
            {settings.heroPath ? (
              <Image
                src={settings.heroPath}
                alt="The bakehouse at night"
                fill
                sizes="(max-width: 768px) 100vw, 560px"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section id="visit" className="shell hidden gap-10 py-16 md:grid md:py-20">
        <SectionHead eyebrow="Visit" title="Where to find us" />
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
          <div className="grid content-start gap-6">
            <div className="flex gap-3">
              <MapPin size={18} className="mt-1 shrink-0 text-[var(--ember)]" aria-hidden />
              <div className="grid gap-1">
                <p className="font-display text-lg">Collection point</p>
                <p className="muted text-sm leading-6">{settings.pickupAddress}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock size={18} className="mt-1 shrink-0 text-[var(--ember)]" aria-hidden />
              <div className="grid gap-2">
                <p className="font-display text-lg">Sunday collection slots</p>
                <ul className="muted grid gap-1 text-sm">
                  {slots.map((slot) => (
                    <li key={slot.id}>
                      {formatClock(slot.start)} – {formatClock(slot.end)}
                      <span className="faint"> · {slot.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {deliveryWindows.length > 0 ? (
              <div className="flex gap-3">
                <Truck size={18} className="mt-1 shrink-0 text-[var(--ember)]" aria-hidden />
                <div className="grid gap-2">
                  <p className="font-display text-lg">Delivery handoff windows</p>
                  <ul className="muted grid gap-1 text-sm">
                    {deliveryWindows.map((window) => (
                      <li key={window.id}>
                        {formatDay(window.date)} · {formatClock(window.start)} –{" "}
                        {formatClock(window.end)}
                        <span className="faint"> · {window.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <div className="flex gap-3">
              <Phone size={18} className="mt-1 shrink-0 text-[var(--ember)]" aria-hidden />
              <div className="grid gap-1">
                <p className="font-display text-lg">Talk to us</p>
                <a
                  href={`tel:${settings.contactPhone.replace(/\s/g, "")}`}
                  className="link-underline text-sm"
                >
                  {settings.contactPhone}
                </a>
                {settings.contactTelephone ? (
                  <a
                    href={`tel:${settings.contactTelephone.replace(/\s/g, "")}`}
                    className="link-underline text-sm"
                  >
                    Tel {settings.contactTelephone}
                  </a>
                ) : null}
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="link-underline text-sm"
                >
                  {settings.contactEmail}
                </a>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-3">
            <Eyebrow>Good to know</Eyebrow>
            <Faq
              items={[
                {
                  q: "Can I order for this weekend right now?",
                  a: open
                    ? `Yes. Ordering closes ${formatDateTime(cycle.cutoffAt)} and you collect on ${formatDay(cycle.pickupDate)}.`
                    : `Ordering for ${formatDay(cycle.pickupDate)} has closed. The next rotation opens shortly after collection.`,
                },
                {
                  q: "How does delivery work?",
                  a:
                    deliveryWindows.length > 0
                      ? `${settings.deliveryNote} Available handoff windows this week: ${deliveryWindows
                          .map(
                            (w) =>
                              `${formatDay(w.date)} ${formatClock(w.start)}–${formatClock(w.end)}`,
                          )
                          .join("; ")}.`
                      : settings.deliveryNote,
                },
                { q: "Why do I pay everything up front?", a: settings.policies },
                { q: "What if I need to cancel?", a: settings.cancellationPol },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Native details/summary rather than a scripted accordion: it is keyboard
 * accessible and searchable in-page for free, and works with JS disabled.
 */
function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
            {item.q}
            <span
              aria-hidden
              className="faint shrink-0 text-lg leading-none transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="muted mt-2 text-sm leading-6">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
