import { cn } from "@/lib/cn";
import {
  WEEKDAYS_SHORT,
  addDays,
  manilaDateKey,
  manilaParts,
  type BakeCycle,
} from "@/lib/time";

/**
 * The Bake Week strip.
 *
 * Mon–Thu: collect orders · Fri: bake · Sat–Sun: bake & deliver.
 */

type Phase = "order" | "bake" | "bakeDeliver" | "rest";

const PHASE_LABEL: Record<Phase, string> = {
  order: "Order",
  bake: "Bake",
  bakeDeliver: "Bake & Del",
  rest: "Closed",
};

const PHASE_LABEL_SHORT: Record<Phase, string> = {
  order: "Order",
  bake: "Bake",
  bakeDeliver: "B&D",
  rest: "—",
};

function phaseForDay(input: {
  key: string;
  weekday: number;
  cutoffKey: string;
}): Phase {
  const { key, weekday, cutoffKey } = input;

  // Sat (6) + Sun (0): bake and deliver.
  if (weekday === 6 || weekday === 0) return "bakeDeliver";
  // Fri (5): bake only.
  if (weekday === 5) return "bake";
  // Mon–Thu: taking orders through Thursday cutoff.
  if (key <= cutoffKey) return "order";
  return "rest";
}

export function BakeWeek({
  cycle,
  now = new Date(),
  className,
}: {
  cycle: BakeCycle;
  now?: Date;
  className?: string;
}) {
  const todayKey = manilaDateKey(now);
  const cutoffKey = manilaDateKey(cycle.cutoffAt);

  // Seven cells ending on the pickup Sunday, so the strip reads Mon–Sun.
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(cycle.pickupDate, index - 6);
    const key = manilaDateKey(date);
    const parts = manilaParts(date);
    const phase = phaseForDay({
      key,
      weekday: parts.weekday,
      cutoffKey,
    });

    return {
      key,
      parts,
      phase,
      isToday: key === todayKey,
      isCutoff: key === cutoffKey,
    };
  });

  return (
    <div className={cn("grid gap-3", className)}>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {days.map((day) => (
          <li
            key={day.key}
            className={cn(
              "relative grid gap-1 rounded-[var(--radius-sm)] border px-1 py-2.5 text-center sm:px-2 sm:py-3",
              day.isToday
                ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--surface-2)_70%,var(--ember)_18%)]"
                : "border-[var(--line)] bg-[var(--surface)]",
              day.phase === "rest" && !day.isToday && "opacity-45",
            )}
            aria-current={day.isToday ? "date" : undefined}
          >
            <span className="faint text-[0.6rem] font-semibold uppercase tracking-[0.12em]">
              {WEEKDAYS_SHORT[day.parts.weekday]}
            </span>
            <span
              className={cn(
                "font-display text-lg leading-none tnum",
                day.isToday && "text-[var(--ember-glow)]",
              )}
            >
              {day.parts.day}
            </span>
            <span
              className={cn(
                "text-[0.55rem] font-semibold uppercase tracking-[0.04em] leading-tight sm:text-[0.6rem] sm:tracking-[0.06em]",
                day.phase === "bakeDeliver"
                  ? "text-[var(--ember)]"
                  : day.phase === "bake"
                    ? "text-[var(--wheat)]"
                    : "text-[var(--faint)]",
              )}
            >
              <span className="sm:hidden">{PHASE_LABEL_SHORT[day.phase]}</span>
              <span className="hidden sm:inline">{PHASE_LABEL[day.phase]}</span>
            </span>
            {day.isCutoff ? (
              <span
                aria-hidden
                title="Order cutoff"
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--ember)]"
              />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="faint text-[0.7rem] leading-5">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--ember)]" />
          Cutoff Thursday
        </span>
        <span className="mx-2 opacity-40">·</span>
        Mon–Thu take orders · Fri bake · Sat–Sun bake &amp; deliver
      </p>
    </div>
  );
}
