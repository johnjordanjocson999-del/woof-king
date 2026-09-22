"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, ShoppingBag, ClipboardList, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Instagram / food-app style bottom tabs — phones only.
 * Desktop keeps the classic header nav unchanged.
 */
const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/menu",
    label: "Menu",
    icon: UtensilsCrossed,
    match: (p: string) => p === "/menu" || p.startsWith("/bread"),
  },
  {
    href: "/basket",
    label: "Basket",
    icon: ShoppingBag,
    match: (p: string) => p === "/basket" || p.startsWith("/checkout"),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ClipboardList,
    match: (p: string) => p === "/orders" || p.startsWith("/order"),
  },
  {
    href: "/account",
    label: "Account",
    icon: UserRound,
    match: (p: string) =>
      p.startsWith("/account") || p.startsWith("/login") || p.startsWith("/signup"),
  },
] as const;

export function MobileTabBar({
  basketCount = 0,
  signedIn = false,
  activeOrderCount = 0,
}: {
  basketCount?: number;
  signedIn?: boolean;
  activeOrderCount?: number;
}) {
  const pathname = usePathname();

  // Hide on admin / staff / receipt print clutter — storefront only.
  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return null;

  return (
    <nav
      aria-label="App"
      className={cn(
        "no-print fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_96%,transparent)] backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5">
        {TABS.map((tab) => {
          const href =
            tab.href === "/account" && !signedIn ? "/login" : tab.href;
          const active = tab.match(pathname);
          const Icon = tab.icon;
          const showBasketBadge = tab.href === "/basket" && basketCount > 0;
          const showOrderBadge = tab.href === "/orders" && activeOrderCount > 0;
          const badgeCount = showBasketBadge
            ? basketCount
            : showOrderBadge
              ? activeOrderCount
              : 0;

          return (
            <li key={tab.href}>
              <Link
                href={href}
                className={cn(
                  "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-colors",
                  active
                    ? "text-[var(--ember)]"
                    : "text-[var(--faint)] active:text-[var(--paper)]",
                )}
              >
                <span className="relative">
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                  {badgeCount > 0 ? (
                    <span
                      className={cn(
                        "absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold tnum",
                        showOrderBadge
                          ? "bg-[var(--ember)] text-[var(--on-ember)] shadow-[0_0_10px_color-mix(in_oklab,var(--ember)_55%,transparent)]"
                          : "bg-[var(--ember)] text-[var(--on-ember)]",
                      )}
                    >
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-[0.62rem] font-semibold tracking-wide",
                    active && "text-[var(--ember-glow)]",
                  )}
                >
                  {tab.label}
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--ember)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
