"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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

export type AdminSlotProp = {
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

type TimeDraft = {
  key: string;
  label: string;
  start: string;
  end: string;
  capacity: string;
  notes: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function newTimeDraft(partial?: Partial<TimeDraft>): TimeDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    start: "09:00",
    end: "11:00",
    capacity: "12",
    notes: "",
    ...partial,
  };
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
  slots: AdminSlotProp[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string[]>([todayKey]);
  const [multiMode, setMultiMode] = useState(false);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("both");
  const [timeDrafts, setTimeDrafts] = useState<TimeDraft[]>([
    newTimeDraft({ label: "Morning", start: "09:00", end: "11:00" }),
  ]);

  const freeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      if (s.active) set.add(s.dateKey);
    }
    return set;
  }, [slots]);

  const selectedSorted = useMemo(() => [...selected].sort(), [selected]);
  const focusDay = selectedSorted[0] ?? todayKey;

  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => selectedSorted.includes(s.dateKey))
        .sort(
          (a, b) =>
            a.dateKey.localeCompare(b.dateKey) || a.start.localeCompare(b.start),
        ),
    [slots, selectedSorted],
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

  function toggleDay(key: string, multi: boolean) {
    setSelected((prev) => {
      if (multi) {
        if (prev.includes(key)) {
          const next = prev.filter((k) => k !== key);
          return next.length > 0 ? next : [key];
        }
        return [...prev, key];
      }
      return [key];
    });
  }

  function patchDraft(key: string, patch: Partial<TimeDraft>) {
    setTimeDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const monthTitle = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const selectedLabel =
    selectedSorted.length === 1
      ? formatDateKey(selectedSorted[0])
      : `${selectedSorted.length} days selected`;

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
            const isSelected = selected.includes(key);
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={(e) =>
                  toggleDay(key, multiMode || e.metaKey || e.ctrlKey || e.shiftKey)
                }
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
          Tap a day to select it. Turn on <strong>Select multiple</strong> (or hold Ctrl / Cmd /
          Shift) to paint several days. Green = already free.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={multiMode}
            onChange={(e) => setMultiMode(e.target.checked)}
          />
          Select multiple days
        </label>
        {selectedSorted.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedSorted.map((key) => (
              <button
                key={key}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.7rem]"
                onClick={() => toggleDay(key, true)}
              >
                {formatDateKey(key)}
                <X size={12} aria-hidden />
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected([focusDay])}
            >
              Clear to one day
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid content-start gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">Selected</p>
          <h2 className="font-display text-2xl">{selectedLabel}</h2>
          {selectedSorted.length > 1 ? (
            <p className="muted text-xs leading-5">
              Actions below apply to all selected days.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <form
            action={(fd) => {
              start(async () => {
                for (const d of selectedSorted) fd.append("dates", d);
                fd.set("kind", "both");
                await openDayStandard(fd);
              });
            }}
          >
            <SubmitButton disabled={pending}>
              Open {selectedSorted.length > 1 ? "days" : "day"} (9–11 &amp; 3–6)
            </SubmitButton>
          </form>
          <form
            action={(fd) => {
              start(async () => {
                for (const d of selectedSorted) fd.append("dates", d);
                await closeAvailabilityDay(fd);
              });
            }}
          >
            <ConfirmSubmit
              disabled={pending}
              message={
                selectedSorted.length > 1
                  ? `Close ${selectedSorted.length} days? Existing bookings stay; those days become order-only.`
                  : "Close this day? Existing bookings stay; the day becomes order-only."
              }
            >
              Close {selectedSorted.length > 1 ? "days" : "day"}
            </ConfirmSubmit>
          </form>
        </div>

        <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg">Add times</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setTimeDrafts((rows) => [
                  ...rows,
                  newTimeDraft({
                    label: "",
                    start: "15:00",
                    end: "18:00",
                  }),
                ])
              }
            >
              <Plus size={14} aria-hidden />
              Add another time
            </button>
          </div>

          <form
            className="grid gap-4"
            action={(fd) => {
              start(async () => {
                for (const d of selectedSorted) fd.append("dates", d);
                fd.set("kind", kind);
                for (const row of timeDrafts) {
                  fd.append("label", row.label);
                  fd.append("start", row.start);
                  fd.append("end", row.end);
                  fd.append("capacity", row.capacity);
                  fd.append("notes", row.notes);
                }
                await createAvailabilitySlot(fd);
              });
            }}
          >
            <label>
              Available for
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="both">Pickup &amp; delivery</option>
                <option value="pickup">Pickup only</option>
                <option value="delivery">Delivery only</option>
              </select>
            </label>

            {timeDrafts.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 sm:grid-cols-2"
              >
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Time {index + 1}</p>
                  {timeDrafts.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setTimeDrafts((rows) => rows.filter((r) => r.key !== row.key))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <label>
                  Label
                  <input
                    value={row.label}
                    onChange={(e) => patchDraft(row.key, { label: e.target.value })}
                    placeholder="Morning / Afternoon"
                  />
                </label>
                <label>
                  Capacity
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={row.capacity}
                    onChange={(e) => patchDraft(row.key, { capacity: e.target.value })}
                  />
                </label>
                <label>
                  Start
                  <input
                    type="time"
                    required
                    value={row.start}
                    onChange={(e) => patchDraft(row.key, { start: e.target.value })}
                  />
                </label>
                <label>
                  End
                  <input
                    type="time"
                    required
                    value={row.end}
                    onChange={(e) => patchDraft(row.key, { end: e.target.value })}
                  />
                </label>
                <label className="sm:col-span-2">
                  Staff notes
                  <input
                    value={row.notes}
                    onChange={(e) => patchDraft(row.key, { notes: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
              </div>
            ))}

            <SubmitButton disabled={pending}>
              Save {timeDrafts.length > 1 ? `${timeDrafts.length} times` : "time"}
              {selectedSorted.length > 1 ? ` on ${selectedSorted.length} days` : ""}
            </SubmitButton>
          </form>
        </div>

        <div className="grid gap-2">
          <h3 className="font-display text-lg">
            Times on {selectedSorted.length > 1 ? "selected days" : "this day"}
          </h3>
          {daySlots.length === 0 ? (
            <p className="muted text-sm">No free times yet — order-only.</p>
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
                      {selectedSorted.length > 1 ? (
                        <span className="muted text-xs">{formatDateKey(slot.dateKey)}</span>
                      ) : null}
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
