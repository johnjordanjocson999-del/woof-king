import Link from "next/link";
import { Instagram, Facebook } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getActiveMenu } from "@/domain/menu";
import { readCart } from "@/lib/cart";
import { resolveBasket } from "@/domain/basket";
import { currentUser, isStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { formatDay } from "@/lib/time";
import { SiteHeader } from "@/components/site-chrome";
import { BasketPill } from "@/components/basket-pill";
import { BasketLines, BasketTotals } from "@/components/basket-lines";
import { RevealRoot } from "@/components/reveal-root";
import { BrandLogo } from "@/components/brand-marks";
import { InstallAppButton } from "@/components/install-app";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ActiveOrderToast } from "@/components/active-order-toast";
import { getActiveOrdersForVisitor } from "@/domain/active-orders";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, menu, cart, user] = await Promise.all([
    getSettings(),
    getActiveMenu(),
    readCart(),
    currentUser(),
  ]);
  const basket = resolveBasket(cart, menu, settings);
  const activeOrders = await getActiveOrdersForVisitor(user?.id);

  return (
    <>
      <a href="#main" className="skip-link btn btn-primary btn-sm">
        Skip to content
      </a>

      <SiteHeader
        signedIn={Boolean(user)}
        showAdmin={isStaff(user)}
        basketCount={basket.totals.itemCount}
        activeOrderCount={activeOrders.length}
      />

      <main id="main" className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      <footer className="no-print mt-16 border-t border-[var(--line)] pb-10 pt-10 md:mt-24 md:pt-14">
        <div className="shell grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="grid content-start gap-4">
            <BrandLogo className="h-[88px] md:h-[120px]" href={null} />
            <p className="muted max-w-xs text-sm leading-6">{settings.tagline}</p>
            {(settings.instagramUrl || settings.facebookUrl) && (
              <div className="flex gap-2">
                {settings.instagramUrl ? (
                  <a
                    href={settings.instagramUrl}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] hover:border-[var(--ember)] hover:text-[var(--ember)]"
                    aria-label="Instagram"
                  >
                    <Instagram size={16} aria-hidden />
                  </a>
                ) : null}
                {settings.facebookUrl ? (
                  <a
                    href={settings.facebookUrl}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] hover:border-[var(--ember)] hover:text-[var(--ember)]"
                    aria-label="Facebook"
                  >
                    <Facebook size={16} aria-hidden />
                  </a>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid content-start gap-3 text-sm">
            <p className="eyebrow">Collect from</p>
            <p className="leading-6">{settings.pickupAddress}</p>
            {menu ? (
              <p className="muted leading-6">Next collection {formatDay(menu.pickupDate)}</p>
            ) : null}
          </div>

          <div className="grid content-start gap-3 text-sm">
            <p className="eyebrow">Reach us</p>
            <a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="link-underline">
              {settings.contactPhone}
            </a>
            {settings.contactTelephone ? (
              <a
                href={`tel:${settings.contactTelephone.replace(/\s/g, "")}`}
                className="link-underline"
              >
                Tel {settings.contactTelephone}
              </a>
            ) : null}
            <a href={`mailto:${settings.contactEmail}`} className="link-underline">
              {settings.contactEmail}
            </a>
            <Link href="/orders" className="muted hover:text-[var(--paper)]">
              Track an order
            </Link>
            <InstallAppButton variant="ghost" className="mt-2 w-fit" label="Get the app" />
            {isStaff(user) ? (
              <Link href="/admin" className="btn btn-ghost btn-sm mt-1 w-fit">
                Admin
              </Link>
            ) : null}
          </div>
        </div>

        <div className="shell mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6">
          <p className="faint text-xs">
            &copy; {new Date().getFullYear()} {settings.bakeryName}. Baked in Candelaria, Quezon.
          </p>
          <p className="faint text-xs">Paid in full at checkout. No cash on delivery.</p>
        </div>
      </footer>

      {/*
        The docked basket is rendered from the layout so it survives navigation
        between the menu, a product page and the basket page itself.
      */}
      <BasketPill count={basket.totals.itemCount} totalLabel={formatPeso(basket.totals.totalCentavos)}>
        <div className="grid gap-6">
          <BasketLines basket={basket} compact />
          <BasketTotals basket={basket} />
          <div className="grid gap-2">
            <Link href="/checkout" className="btn btn-primary w-full">
              Checkout
            </Link>
            <Link href="/basket" className="btn btn-ghost w-full">
              View full basket
            </Link>
          </div>
          {menu ? (
            <p className="faint text-center text-xs leading-5">
              Collection {formatDay(menu.pickupDate)}. Payment is taken in full at checkout.
            </p>
          ) : null}
        </div>
      </BasketPill>

      <MobileTabBar
        basketCount={basket.totals.itemCount}
        signedIn={Boolean(user)}
        activeOrderCount={activeOrders.length}
      />

      <ActiveOrderToast orders={activeOrders} />

      <RevealRoot />
    </>
  );
}
