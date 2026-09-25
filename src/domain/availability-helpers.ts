import type { AvailabilitySlotView } from "@/domain/availability-types";

export type { AvailabilitySlotView, AvailabilityKind } from "@/domain/availability-types";

/** Distinct free date keys that still have open capacity. */
export function openDateKeys(slots: AvailabilitySlotView[]): string[] {
  const keys = new Set<string>();
  for (const slot of slots) {
    if (!slot.active) continue;
    if (slot.booked >= slot.capacity) continue;
    keys.add(slot.dateKey);
  }
  return [...keys].sort();
}

export function slotsForDate(
  slots: AvailabilitySlotView[],
  dateKey: string,
): AvailabilitySlotView[] {
  return slots.filter(
    (s) => s.dateKey === dateKey && s.active && s.booked < s.capacity,
  );
}

export function parseTimeHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}
