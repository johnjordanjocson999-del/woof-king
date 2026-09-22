"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The cutoff countdown, and the centrepiece of the hero.
 *
 * A bakery that only bakes once a week lives or dies on the customer
 * understanding *when* they have to decide. Baymard's checkout research found
 * 83% of sites with an order deadline never show it as a countdown; here it is
 * the largest element on the page.
 *
 * The ring drains anticlockwise over the ordering window, so a glance tells you
 * whether there is a week left or an hour.
 */

interface Props {
  /** Cutoff instant, as an epoch millisecond value. */
  cutoffMs: number;
  /** When the window opened, used for the ring fraction. */
  openedMs: number;
  /**
   * Server-rendered starting values. Seeding state from these means the first
   * client render matches the server HTML exactly, so there is no hydration
   * warning and no flash of a wrong number.
   */
  initial: { days: number; hours: number; minutes: number; seconds: number; expired: boolean };
  /** Formatted cutoff, e.g. "Thu, 24 Sep, 11:59 PM". Comes from settings. */
  cutoffLabel: string;
  size?: number;
  className?: string;
}

function split(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: totalSeconds === 0,
  };
}

export function CountdownRing({
  cutoffMs,
  openedMs,
  initial,
  cutoffLabel,
  size = 210,
  className,
}: Props) {
  const [state, setState] = useState(initial);
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(
      0,
      initial.days * 86400000 +
        initial.hours * 3600000 +
        initial.minutes * 60000 +
        initial.seconds * 1000,
    ),
  );

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const ms = Math.max(0, cutoffMs - Date.now());
      setRemainingMs(ms);
      setState(split(ms));
    };
    tick();
    // Whole seconds only matter near cutoff; otherwise tick slowly.
    const near =
      cutoffMs - Date.now() < 48 * 60 * 60 * 1000; /* under 48h */
    const id = window.setInterval(tick, near ? 1000 : 30_000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cutoffMs]);

  const windowMs = Math.max(1, cutoffMs - openedMs);
  const fraction = Math.min(1, Math.max(0, remainingMs / windowMs));

  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const scale = size / 210;
  const titleSize = Math.max(1.05, 1.6 * scale);
  const timeSize = Math.max(1.15, 2.4 * scale);
  const labelSize = Math.max(0.52, 0.62 * scale);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth="2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ember)"
          strokeWidth={size < 160 ? 2.5 : 3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{
            transition: "stroke-dashoffset 400ms linear",
          }}
        />
      </svg>

      <div className="relative grid justify-items-center gap-0.5 text-center sm:gap-1">
        {state.expired ? (
          <>
            <span
              className="font-display leading-tight"
              style={{ fontSize: `${titleSize}rem` }}
            >
              Orders closed
            </span>
            <span
              className="faint font-semibold uppercase tracking-[0.18em]"
              style={{ fontSize: `${labelSize}rem` }}
            >
              Next rotation soon
            </span>
          </>
        ) : (
          <>
            <span
              className="faint font-semibold uppercase tracking-[0.18em]"
              style={{ fontSize: `${labelSize}rem` }}
            >
              Orders close in
            </span>
            <span
              className="font-display flex items-baseline gap-0.5 leading-none tnum sm:gap-1"
              style={{ fontSize: `${timeSize}rem` }}
              aria-live="polite"
              aria-atomic="true"
            >
              {state.days > 0 ? (
                <>
                  <span>{state.days}</span>
                  <span className="text-[0.4em] text-[var(--muted)]">d</span>
                </>
              ) : null}
              <span>{String(state.hours).padStart(2, "0")}</span>
              <span className="text-[0.4em] text-[var(--muted)]">h</span>
              <span>{String(state.minutes).padStart(2, "0")}</span>
              <span className="text-[0.4em] text-[var(--muted)]">m</span>
              {state.days === 0 ? (
                <>
                  <span>{String(state.seconds).padStart(2, "0")}</span>
                  <span className="text-[0.4em] text-[var(--muted)]">s</span>
                </>
              ) : null}
            </span>
            <span
              className="font-semibold uppercase tracking-[0.16em] text-[var(--ember)]"
              style={{ fontSize: `${labelSize}rem` }}
            >
              {size >= 170 ? cutoffLabel : null}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
