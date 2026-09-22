import { cn } from "@/lib/cn";

/**
 * One-line order window for phones — replaces stacking CountdownRing + BakeWeek
 * above the product list so the table is reachable in one thumb scroll.
 */
export function OrderWindowStrip({
  open,
  cutoffLabel,
  collectLabel,
  className,
}: {
  open: boolean;
  cutoffLabel: string;
  collectLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-[var(--line)] py-3 text-sm",
        className,
      )}
    >
      <span
        className={cn(
          "font-semibold uppercase tracking-[0.14em]",
          open ? "text-[var(--ember)]" : "text-[var(--wheat)]",
        )}
        style={{ fontSize: "0.68rem" }}
      >
        {open ? "Ordering open" : "Ordering closed"}
      </span>
      <span className="faint hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="muted leading-5">
        {open ? (
          <>
            Closes <strong className="text-[var(--paper)]">{cutoffLabel}</strong>
          </>
        ) : (
          <>Next rotation after collection</>
        )}
      </span>
      <span className="faint" aria-hidden>
        ·
      </span>
      <span className="muted leading-5">
        Collect <strong className="text-[var(--paper)]">{collectLabel}</strong>
      </span>
    </div>
  );
}
