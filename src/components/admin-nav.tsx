"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  CalendarDays,
  Wheat,
  BookOpen,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Store,
  Wallet,
  LogOut,
  ChevronDown,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/brand-marks";
import { logoutAction } from "@/app/actions/auth";

const PRIMARY = [
  { href: "/admin", label: "Today", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/pos", label: "Counter", icon: Store },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/menus", label: "Menu", icon: CalendarDays },
  { href: "/admin/print/delivery-card", label: "Box QR", icon: Printer },
] as const;

const MORE = [
  { href: "/admin/availability", label: "Calendar", icon: CalendarDays },
  { href: "/admin/ingredients", label: "Ingredients", icon: Wheat },
  { href: "/admin/purchases", label: "Purchases", icon: ShoppingBag },
  { href: "/admin/recipes", label: "Recipes", icon: BookOpen },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

const ALL = [...PRIMARY, ...MORE];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
  pathname,
  className,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  exact?: boolean;
  pathname: string;
  className?: string;
}) {
  const active = isActive(pathname, href, exact);
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm md:w-full md:gap-2.5",
        active
          ? "bg-[color-mix(in_oklab,var(--ember)_18%,transparent)] text-[var(--ember-glow)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--paper)]",
        className,
      )}
    >
      <Icon size={16} aria-hidden className="shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

export function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const moreActive = MORE.some((item) => isActive(pathname, item.href));
  const [moreOpen, setMoreOpen] = useState(moreActive);

  return (
    <aside
      className={cn(
        "no-print flex w-full flex-col border-b border-[var(--line)] bg-[var(--surface)]",
        "md:h-dvh md:w-56 md:shrink-0 md:border-b-0 md:border-r lg:w-64",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-5 md:py-4">
        <BrandLogo className="h-[32px] md:h-[76px]" href="/admin" />
        <div className="flex items-center gap-2">
          <Link
            href="/"
            prefetch={false}
            className="grid h-9 place-items-center rounded-full border border-[var(--line)] px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] hover:border-[var(--ember)] hover:text-[var(--paper)] md:h-10"
          >
            Site
          </Link>
          <form action={logoutAction} className="md:hidden">
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)]"
              aria-label="Sign out"
            >
              <LogOut size={14} aria-hidden />
            </button>
          </form>
        </div>
      </div>

      <nav aria-label="Admin" className="md:contents">
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2 md:hidden">
          {PRIMARY.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm",
              moreOpen || moreActive
                ? "bg-[color-mix(in_oklab,var(--ember)_18%,transparent)] text-[var(--ember-glow)]"
                : "text-[var(--muted)]",
            )}
            aria-expanded={moreOpen}
          >
            More
            <ChevronDown size={14} aria-hidden className={cn(moreOpen && "rotate-180")} />
          </button>
          {moreOpen ? (
            <div className="grid w-full basis-full grid-cols-2 gap-1 border-t border-[var(--line)] pt-2">
              {MORE.map((item) => (
                <NavLink key={item.href} {...item} pathname={pathname} className="w-full" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2 md:flex">
          {ALL.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="mt-auto hidden shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-4 md:flex">
        <span className="truncate text-xs text-[var(--muted)]">{userName}</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] hover:border-[var(--ember)]"
            aria-label="Sign out"
          >
            <LogOut size={14} aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}
