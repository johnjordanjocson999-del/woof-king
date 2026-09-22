"use client";

import { cn } from "@/lib/cn";

/**
 * Sticky commerce strip for phones — sits above the bottom tab bar.
 */
export function MobileStickyBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Tab bar replaced the floating pill offset. */
  offsetForPill?: boolean;
}) {
  return (
    <div
      className={cn(
        "no-print fixed inset-x-0 z-30 border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_94%,transparent)] px-4 pt-3 backdrop-blur-sm md:hidden",
        "bottom-[calc(3.75rem+env(safe-area-inset-bottom))] pb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
