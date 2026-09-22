"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/brand-marks";
import { InstallAppButton } from "@/components/install-app";

/**
 * Storefront header.
 * Desktop: full nav (unchanged). Phone: compact logo bar — tabs handle navigation.
 */

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "This week" },
  { href: "/#story", label: "Story" },
  { href: "/#visit", label: "Visit" },
  { href: "/orders", label: "My orders" },
];

export function SiteHeader({
  signedIn,
  showAdmin = false,
  activeOrderCount = 0,
}: {
  signedIn: boolean;
  showAdmin?: boolean;
  basketCount?: number;
  activeOrderCount?: number;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "no-print sticky top-0 z-30",
        "max-md:border-b max-md:border-[var(--line)] max-md:bg-[var(--ink)]",
        scrolled
          ? "md:border-b md:border-[var(--line)] md:bg-[var(--ink)]"
          : "md:border-b md:border-transparent md:bg-transparent",
      )}
    >
      {/* Phone app bar */}
      <div className="shell flex h-[3.75rem] items-center justify-between gap-3 pt-[env(safe-area-inset-top)] md:hidden">
        <BrandLogo priority className="h-[44px]" />
        <div className="flex items-center gap-1.5">
          {activeOrderCount > 0 ? (
            <Link
              href="/orders"
              className="relative grid h-9 place-items-center rounded-full border border-[color-mix(in_oklab,var(--ember)_40%,var(--line))] bg-[color-mix(in_oklab,var(--surface)_80%,var(--ember)_12%)] px-3 text-[0.7rem] font-semibold text-[var(--ember)]"
            >
              {activeOrderCount} active
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--ember)] shadow-[0_0_8px_var(--ember)]"
              />
            </Link>
          ) : null}
          {showAdmin ? (
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
          ) : null}
          <InstallAppButton variant="solid" compact label="Get app" />
        </div>
      </div>

      {/* Desktop header — same as before */}
      <div className="shell hidden h-[6.5rem] items-center justify-between gap-4 md:flex">
        <BrandLogo priority className="h-[92px]" />

        <nav aria-label="Main" className="flex items-center gap-7">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-[0.82rem] font-medium tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--paper)]"
            >
              {link.label}
              {link.href === "/orders" && activeOrderCount > 0 ? (
                <span className="absolute -right-3 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ember)] px-1 text-[0.58rem] font-bold text-[var(--on-ember)] tnum">
                  {activeOrderCount > 9 ? "9+" : activeOrderCount}
                </span>
              ) : null}
            </Link>
          ))}
          <Link href={signedIn ? "/account" : "/login"} className="btn btn-ghost btn-sm">
            {signedIn ? "Account" : "Sign in"}
          </Link>
          <InstallAppButton variant="primary" compact label="Get the app" />
          {showAdmin ? (
            <Link href="/admin" className="btn btn-solid btn-sm">
              Admin
            </Link>
          ) : null}
          <Link href="/menu" className="btn btn-primary btn-sm">
            Pre-order
          </Link>
        </nav>
      </div>
    </header>
  );
}
