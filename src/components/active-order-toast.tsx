"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActiveOrderNotice } from "@/domain/active-orders";

function dismissKey(order: ActiveOrderNotice) {
  return `wk_notice_${order.code}_${order.fulfillmentStatus}_${order.paymentStatus}`;
}

/**
 * Floating active-order notice — phone (above tab bar) and desktop (bottom-right).
 * Reappears when status changes even if the previous state was dismissed.
 */
export function ActiveOrderToast({ orders }: { orders: ActiveOrderNotice[] }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState<ActiveOrderNotice[]>([]);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = orders.filter((order) => {
      const onOwnPage =
        pathname.startsWith(`/order/${order.code}`) ||
        pathname === "/orders";
      if (onOwnPage) return false;
      try {
        return sessionStorage.getItem(dismissKey(order)) !== "1";
      } catch {
        return true;
      }
    });
    setVisible(next);
  }, [orders, pathname]);

  useEffect(() => {
    if (visible.length === 0) {
      setEntered(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible.length]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return null;
  if (visible.length === 0) return null;

  const primary = visible[0];
  const extra = visible.length - 1;
  const href = `/order/${primary.code}/status?token=${encodeURIComponent(primary.token)}`;

  function dismiss() {
    try {
      for (const order of visible) {
        sessionStorage.setItem(dismissKey(order), "1");
      }
    } catch {
      /* private mode */
    }
    setEntered(false);
    window.setTimeout(() => setVisible([]), 220);
  }

  return (
    <div
      className={cn(
        "no-print pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3",
        "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:inset-x-auto md:right-6 md:justify-end",
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-[0_22px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-300",
          primary.urgency === "high"
            ? "border-[color-mix(in_oklab,var(--ember)_55%,var(--line))] bg-[color-mix(in_oklab,var(--surface)_88%,var(--ember)_14%)]"
            : "border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_92%,var(--surface)_80%)]",
          entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div className="flex gap-3 p-3.5 pr-2.5">
          <span
            className={cn(
              "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full",
              primary.urgency === "high"
                ? "bg-[var(--ember)] text-[var(--on-ember)] shadow-[0_0_24px_color-mix(in_oklab,var(--ember)_45%,transparent)]"
                : "border border-[var(--line)] text-[var(--ember)]",
            )}
          >
            <Bell size={18} aria-hidden className={primary.urgency === "high" ? "animate-pulse" : undefined} />
          </span>

          <div className="min-w-0 flex-1 grid gap-0.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--ember)]">
              Active order{extra > 0 ? `s · ${visible.length}` : ""}
            </p>
            <p className="font-display text-[1.15rem] leading-tight text-[var(--paper)]">
              {primary.headline}
            </p>
            <p className="muted truncate text-[0.78rem] leading-5">{primary.detail}</p>
            {extra > 0 ? (
              <p className="faint text-[0.7rem]">
                +{extra} more active order{extra === 1 ? "" : "s"}
              </p>
            ) : null}
            <Link
              href={extra > 0 ? "/orders" : href}
              className="mt-2 inline-flex w-fit items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--ember-glow)] underline-offset-2 hover:underline"
            >
              {extra > 0 ? "View orders" : "Open order"}
              <span aria-hidden>→</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--paper)]"
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
