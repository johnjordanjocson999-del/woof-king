"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  closeAvailabilityDay,
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  openDayStandard,
  toggleAvailabilitySlot,
} from "@/app/actions/availability";
import { SubmitButton, ConfirmSubmit } from "@/components/form";
import { Chip } from "@/components/ui";

export type AdminSlotRow = {
  id: string;
  dateKey: string;
  kind: string;
  label: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
  active: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function AdminAvailabilityCalendar({
  initialYear,
  initialMonth,
  todayKey,
  slots,
}: {
  initialYear: number;
  initialMonth: number; // 1-12
  todayKey: string;
  slots: AdminSlotRow[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState(todayKey);
  const [pending, start] = useTransition();

  const freeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      if (s.active) set.add(s.dateKey);
    }
    return set;
  }, [slots]);

  const daySlots = useMemo(
    () => slots.filter((s) => s.dateKey === selected).sort((a, b) => a.start.localeCompare(b.start)),
    [slots, selected],
  );

  const cells = useMemo(() => {
    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const count = daysInMonth(year, month);
    const out: Array<{ key: string; day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ key: `e-${i}`, day: null });
    for (let d = 1; d <= count; d++) {
      out.push({ key: `${year}-${pad(month)}-${pad(d)}`, day: d });
    }
    return out;
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const monthTitle = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <p className="font-display text-xl">{monthTitle}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--faint)]">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            if (cell.day === null) {
              return <span key={cell.key} className="min-h-11" />;
            }
            const key = cell.key;
            const isFree = freeKeys.has(key);
            const isSelected = selected === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  "relative grid min-h-11 place-items-center rounded-lg border text-sm font-semibold transition",
                  isSelected
                    ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--ember)_18%,var(--surface))] text-[var(--ember-glow)]"
                    : isFree
                      ? "border-[color-mix(in_oklab,var(--success)_45%,var(--line))] bg-[color-mix(in_oklab,var(--success)_10%,transparent)]"
                      : "border-transparent hover:border-[var(--line)]",
                  isToday && !isSelected && "ring-1 ring-[var(--line-strong)]",
                )}
              >
                {cell.day}
                {isFree ? (
                  <span
                    aria-hidden
                    className="absolute bottom-1 size-1 rounded-full bg-[var(--success)]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="muted text-xs leading-5">
          Green days are free for pickup / delivery. Other days stay order-only — customers can still
          order while the menu is open, but cannot book handoff that day.
        </p>
      </div>

      <div className="grid content-start gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">Selected day</p>
          <h2 className="font-display text-2xl">{selected}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <form
            action={(fd) => {
              start(async () => {
                fd.set("date", selected);
                fd.set("kind", "both");
                await openDayStandard(fd);
              });
            }}
          >
            <SubmitButton disabled={pending}>Open day (9–11 &amp; 3–6)</SubmitButton>
          </form>
          <form
            action={(fd) => {
              start(async () => {
                fd.set("date", selected);
                await closeAvailabilityDay(fd);
              });
            }}
          >
            <ConfirmSubmit
              disabled={pending}
              message="Close this day? Existing bookings stay; the day becomes order-only."
            >
              Close day
            </ConfirmSubmit>
          </form>
        </div>

        <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] p-4">
          <h3 className="font-display text-lg">Add a time</h3>
          <form
            className="grid gap-3 sm:grid-cols-2"
            action={(fd) => {
              start(async () => {
                fd.set("date", selected);
                await createAvailabilitySlot(fd);
              });
            }}
          >
            <label>
              Available for
              <select name="kind" defaultValue="both">
                <option value="both">Pickup &amp; delivery</option>
                <option value="pickup">Pickup only</option>
                <option value="delivery">Delivery only</option>
              </select>
            </label>
            <label>
              Label
              <input name="label" placeholder="Morning / Afternoon" />
            </label>
            <label>
              Start
              <input name="start" type="time" required defaultValue="09:00" />
            </label>
            <label>
              End
              <input name="end" type="time" required defaultValue="11:00" />
            </label>
            <label>
              Capacity
              <input name="capacity" type="number" min={1} max={200} defaultValue={12} />
            </label>
            <label className="sm:col-span-2">
              Staff notes
              <input name="notes" placeholder="Optional" />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton disabled={pending}>Save time band</SubmitButton>
            </div>
          </form>
        </div>

        <div className="grid gap-2">
          <h3 className="font-display text-lg">Times on this day</h3>
          {daySlots.length === 0 ? (
            <p className="muted text-sm">No free times yet — this day is order-only.</p>
          ) : (
            <ul className="grid gap-2">
              {daySlots.map((slot) => (
                <li
                  key={slot.id}
                  className={cn(
                    "grid gap-2 rounded-[var(--radius-md)] border border-[var(--line)] p-3 sm:grid-cols-[1fr_auto]",
                    !slot.active && "opacity-55",
                  )}
                >
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {slot.start} – {slot.end}
                      </span>
                      <Chip tone={slot.active ? "sage" : "neutral"}>
                        {slot.active ? "Open" : "Closed"}
                      </Chip>
                      <Chip>{slot.kind}</Chip>
                    </div>
                    <p className="muted text-xs">
                      {slot.label || "Time band"} · {slot.booked}/{slot.capacity} booked
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form
                      action={(fd) => {
                        start(async () => {
                          fd.set("id", slot.id);
                          await toggleAvailabilitySlot(fd);
                        });
                      }}
                    >
                      <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
                        {slot.active ? "Hide" : "Show"}
                      </button>
                    </form>
                    <form
                      action={(fd) => {
                        start(async () => {
                          fd.set("id", slot.id);
                          await deleteAvailabilitySlot(fd);
                        });
                      }}
                    >
                      <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
