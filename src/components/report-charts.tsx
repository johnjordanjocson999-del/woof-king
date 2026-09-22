"use client";

import { cn } from "@/lib/cn";

export type MoneyBar = { label: string; value: number; tone?: "ember" | "sage" | "danger" | "muted" };

const TONE: Record<NonNullable<MoneyBar["tone"]>, string> = {
  ember: "var(--ember)",
  sage: "var(--success)",
  danger: "var(--danger)",
  muted: "var(--muted)",
};

/** Horizontal comparison bars — revenue vs costs. */
export function MoneyCompareChart({
  bars,
  className,
}: {
  bars: MoneyBar[];
  className?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));

  return (
    <div className={cn("grid gap-3", className)} role="img" aria-label="Money comparison chart">
      {bars.map((bar) => {
        const width = Math.round((Math.abs(bar.value) / max) * 100);
        return (
          <div key={bar.label} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="muted">{bar.label}</span>
              <span className="price tnum font-semibold">
                ₱{Math.round(bar.value / 100).toLocaleString("en-PH")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${width}%`,
                  background: TONE[bar.tone ?? "ember"],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type DayPoint = { label: string; valueCentavos: number };

/** Simple 7-day revenue columns. */
export function DailyRevenueChart({
  points,
  className,
}: {
  points: DayPoint[];
  className?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.valueCentavos));
  const chartH = 120;

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        className="flex items-end justify-between gap-1.5 sm:gap-2"
        style={{ height: chartH }}
        role="img"
        aria-label="Daily sales chart"
      >
        {points.map((p) => {
          const h = Math.max(4, Math.round((p.valueCentavos / max) * (chartH - 8)));
          return (
            <div key={p.label} className="grid h-full flex-1 grid-rows-[1fr_auto] justify-items-center gap-2">
              <div className="flex w-full items-end justify-center">
                <div
                  className="w-full max-w-[2.25rem] rounded-t-[6px] bg-[var(--ember)]"
                  style={{ height: h }}
                  title={`₱${(p.valueCentavos / 100).toFixed(0)}`}
                />
              </div>
              <span className="faint text-[0.65rem] uppercase tracking-wide">{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type StockBar = {
  name: string;
  onHand: number;
  threshold: number;
  unit: string;
};

/** Materials left vs reorder line. */
export function MaterialsChart({
  items,
  className,
}: {
  items: StockBar[];
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="muted text-sm">No ingredient stock recorded yet.</p>;
  }

  return (
    <ul className={cn("grid gap-3", className)} aria-label="Materials on hand">
      {items.map((item) => {
        const max = Math.max(item.onHand, item.threshold, 1);
        const handPct = Math.round((item.onHand / max) * 100);
        const threshPct = Math.round((item.threshold / max) * 100);
        const low = item.onHand < item.threshold;
        return (
          <li key={item.name} className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{item.name}</span>
              <span className={cn("tnum text-xs", low ? "text-[var(--danger)]" : "muted")}>
                {formatQty(item.onHand, item.unit)}
                {item.threshold > 0 ? ` · reorder ${formatQty(item.threshold, item.unit)}` : ""}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${handPct}%`,
                  background: low ? "var(--danger)" : "var(--success)",
                }}
              />
              {item.threshold > 0 ? (
                <span
                  className="absolute inset-y-0 w-0.5 bg-[var(--paper)] opacity-70"
                  style={{ left: `${threshPct}%` }}
                  title="Reorder line"
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatQty(n: number, unit: string): string {
  if (unit === "g" && n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} kg`;
  if (unit === "ml" && n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} L`;
  return `${Math.round(n).toLocaleString("en-PH")} ${unit}`;
}

export type Slice = { label: string; valueCentavos: number; color: string };

/** Donut for overhead / expense mix. */
export function ExpenseDonut({
  slices,
  className,
}: {
  slices: Slice[];
  className?: string;
}) {
  const total = slices.reduce((s, x) => s + x.valueCentavos, 0);
  if (total <= 0) {
    return <p className="muted text-sm">No expenses logged for this month yet.</p>;
  }

  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center", className)}>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden className="justify-self-center">
        <g transform="translate(60,60)">
          {slices
            .filter((s) => s.valueCentavos > 0)
            .map((slice) => {
              const len = (slice.valueCentavos / total) * c;
              const el = (
                <circle
                  key={slice.label}
                  r={r}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="16"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90)"
                />
              );
              offset += len;
              return el;
            })}
          <circle r="28" fill="var(--surface)" />
        </g>
      </svg>
      <ul className="grid gap-2 text-sm">
        {slices
          .filter((s) => s.valueCentavos > 0)
          .map((slice) => (
            <li key={slice.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: slice.color }}
                  aria-hidden
                />
                {slice.label}
              </span>
              <span className="price tnum">
                ₱{Math.round(slice.valueCentavos / 100).toLocaleString("en-PH")}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
