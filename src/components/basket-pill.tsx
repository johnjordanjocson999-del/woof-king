"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Floating basket chip — desktop bottom-right, phone above the tab bar.
 * Hidden on /basket and /checkout so payment / photo UI stays clear.
 */
export function BasketPill({
  count,
  totalLabel,
  children,
}: {
  count: number;
  totalLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const hideChrome = pathname === "/basket" || pathname.startsWith("/checkout");

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (count === 0 || hideChrome) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "no-print fixed z-[60] inline-flex items-center rounded-full border",
          "border-[color-mix(in_oklab,var(--ember)_60%,transparent)]",
          "bg-[var(--ink)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.85)]",
          "active:scale-[0.97]",
          // Compact on phone, original size on desktop
          "gap-2 py-2 pl-3 pr-2 md:min-h-12 md:gap-3 md:py-2.5 md:pl-4 md:pr-2.5",
          // Phone: clear of tab bar + sticky buy bars; desktop: classic corner
          "right-[max(0.85rem,env(safe-area-inset-right))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
          open && "pointer-events-none opacity-0",
        )}
      >
        <ShoppingBag
          size={15}
          className="shrink-0 text-[var(--ember)] md:size-[17px]"
          aria-hidden
        />
        <span className="text-[0.78rem] font-semibold leading-none text-[var(--paper)] md:text-sm">
          {totalLabel}
        </span>
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--ember)] px-1.5 text-[0.65rem] font-bold text-[#1a0e05] tnum md:h-7 md:min-w-7 md:text-xs">
          {count}
        </span>
        <span className="sr-only">Open basket</span>
      </button>

      {open ? (
        <div className="no-print fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close basket"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(6,5,4,0.82)]"
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Your basket"
            className={cn(
              "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] border-t border-[var(--line-strong)] bg-[var(--surface)] p-5",
              "pb-[max(2rem,env(safe-area-inset-bottom))]",
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[26rem] sm:max-h-none sm:rounded-none sm:rounded-l-[var(--radius-xl)] sm:border-l sm:border-t-0 sm:p-6",
            )}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl">Your basket</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] hover:border-[var(--ember)]"
                aria-label="Close basket"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
