"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { ChoiceCard, Notice } from "@/components/ui";
import { formatClock } from "@/lib/time";
import type { AvailabilitySlotView } from "@/domain/availability-types";
import { openDateKeys, slotsForDate } from "@/domain/availability-helpers";

/**
 * Customer picks a free calendar day, then a time band the owner opened.
 */
export function CheckoutAvailabilityPicker({
  fulfillment,
  slots,
  selectedDateKey,
  selectedSlotId,
  onSelectDate,
  onSelectSlot,
  error,
}: {
  fulfillment: "pickup" | "delivery";
  slots: AvailabilitySlotView[];
  selectedDateKey: string;
  selectedSlotId: string;
  onSelectDate: (dateKey: string) => void;
  onSelectSlot: (slotId: string) => void;
  error?: string;
}) {
  const dates = useMemo(() => openDateKeys(slots), [slots]);
  const times = useMemo(
    () => (selectedDateKey ? slotsForDate(slots, selectedDateKey) : []),
    [slots, selectedDateKey],
  );

  if (dates.length === 0) {
    return (
      <Notice tone="warn" title={`No ${fulfillment} days open yet`}>
        The bakery has not marked any free {fulfillment} days on the calendar. You can still leave
        your details — message them after ordering, or choose the other option if it has times.
      </Notice>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-semibold">
          {fulfillment === "pickup" ? "Pickup date" : "Delivery date"}
        </p>
        <p className="muted text-xs leading-5">
          Only days the bakery marked free are shown. Other days are order-only.
        </p>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {dates.map((key) => {
            const openCount = slotsForDate(slots, key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onSelectDate(key);
                }}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition",
                  selectedDateKey === key
                    ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--ember)_14%,var(--surface))]"
                    : "border-[var(--line)] hover:border-[var(--ember)]",
                )}
              >
                <span className="block font-semibold">{formatDateKey(key)}</span>
                <span className="muted text-[0.7rem]">
                  {openCount} time{openCount === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDateKey ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold">Available time</p>
          {times.length === 0 ? (
            <Notice tone="warn" title="No times left">
              That day is full or closed. Pick another date.
            </Notice>
          ) : (
            <div className="grid items-stretch gap-2 sm:grid-cols-2">
              {times.map((slot) => {
                const left = Math.max(0, slot.capacity - slot.booked);
                return (
                  <ChoiceCard
                    key={slot.id}
                    name="availabilitySlotId"
                    value={slot.id}
                    checked={selectedSlotId === slot.id}
                    onChange={() => onSelectSlot(slot.id)}
                    title={slot.label || `${formatClock(slot.start)} – ${formatClock(slot.end)}`}
                    meta={`${left} left`}
                  >
                    {formatClock(slot.start)} – {formatClock(slot.end)}
                    <br />
                    <span className="capitalize">{slot.kind === "both" ? "Pickup or delivery" : slot.kind}</span>
                  </ChoiceCard>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="muted text-sm">Choose a date to see times.</p>
      )}

      {/* Date key kept for restore-on-error; slot id comes from ChoiceCard radios */}
      <input type="hidden" name="fulfillmentDateKey" value={selectedDateKey} />
    </div>
  );
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
