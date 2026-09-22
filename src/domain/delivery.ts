import { db } from "@/lib/db";
import {
  WEEKDAYS,
  addDays,
  manilaDateKey,
  manilaParts,
  manilaStartOfDay,
} from "@/lib/time";

/**
 * Bakery delivery availability: Saturday + Sunday only,
 * morning 9–11 and afternoon 3–6 (Manila).
 * Day offsets are relative to the weekly menu pickup date (usually Sunday).
 */
export const STANDARD_DELIVERY_DAY_OFFSETS = [-1, 0] as const;

export const STANDARD_DELIVERY_BANDS = [
  { labelPart: "morning", start: "09:00", end: "11:00", capacity: 15 },
  { labelPart: "afternoon", start: "15:00", end: "18:00", capacity: 15 },
] as const;

export type StandardDeliverySlot = {
  date: Date;
  start: string;
  end: string;
  label: string;
  capacity: number;
  position: number;
};

/** Four standard windows for a menu whose pickup day is typically Sunday. */
export function standardDeliverySlotsForPickup(pickupDate: Date): StandardDeliverySlot[] {
  const slots: StandardDeliverySlot[] = [];
  let position = 0;
  for (const offset of STANDARD_DELIVERY_DAY_OFFSETS) {
    const date = manilaStartOfDay(addDays(pickupDate, offset));
    const weekday = WEEKDAYS[manilaParts(date).weekday];
    for (const band of STANDARD_DELIVERY_BANDS) {
      slots.push({
        date,
        start: band.start,
        end: band.end,
        label: `${weekday} ${band.labelPart}`,
        capacity: band.capacity,
        position: position++,
      });
    }
  }
  return slots;
}

/**
 * Creates the standard Sat/Sun windows for a menu when none exist yet.
 * Pass `replace = true` to wipe empty non-standard windows and fill gaps
 * (keeps windows that already have orders; hides non-standard ones with orders).
 */
export async function ensureStandardDeliveryWindows(
  menuId: string,
  pickupDate: Date,
  options?: { replace?: boolean },
): Promise<number> {
  const existing = await db.deliveryWindow.findMany({
    where: { menuId },
    include: { _count: { select: { orders: true } } },
  });

  const desired = standardDeliverySlotsForPickup(pickupDate);
  const desiredKeys = new Set(
    desired.map((s) => `${manilaDateKey(s.date)}|${s.start}|${s.end}`),
  );

  if (options?.replace) {
    for (const w of existing) {
      const key = `${manilaDateKey(w.date)}|${w.start}|${w.end}`;
      const isStandard = desiredKeys.has(key);
      if (!isStandard && w._count.orders === 0) {
        await db.deliveryWindow.delete({ where: { id: w.id } });
      } else if (!isStandard) {
        await db.deliveryWindow.update({
          where: { id: w.id },
          data: { active: false },
        });
      }
    }
  } else if (existing.length > 0) {
    // Still fill any missing standard slots below.
  }

  const remaining = await db.deliveryWindow.findMany({ where: { menuId } });
  const byKey = new Map<string, (typeof remaining)[number]>();
  for (const w of remaining) {
    byKey.set(`${manilaDateKey(w.date)}|${w.start}|${w.end}`, w);
  }

  let created = 0;
  let position = remaining.reduce((m, w) => Math.max(m, w.position), -1);

  for (const slot of desired) {
    const key = `${manilaDateKey(slot.date)}|${slot.start}|${slot.end}`;
    const found = byKey.get(key);
    if (found) {
      if (found.label !== slot.label || !found.active) {
        await db.deliveryWindow.update({
          where: { id: found.id },
          data: { label: slot.label, active: true },
        });
      }
      continue;
    }
    position += 1;
    await db.deliveryWindow.create({
      data: {
        menuId,
        date: slot.date,
        start: slot.start,
        end: slot.end,
        label: slot.label,
        capacity: slot.capacity,
        position,
        active: true,
        notes: "Standard weekend handoff. Flat ₱50 delivery fee.",
      },
    });
    created += 1;
  }

  return created;
}

/**
 * Active delivery windows for a weekly menu, with how many paid/pending
 * orders already hold each one. Used by checkout and the menu page.
 */
export async function deliveryWindowsForMenu(menuId: string, date: Date) {
  const day = manilaStartOfDay(date);
  const windows = await db.deliveryWindow.findMany({
    where: {
      active: true,
      OR: [{ menuId }, { menuId: null, date: day }],
    },
    orderBy: [{ date: "asc" }, { position: "asc" }, { start: "asc" }],
  });

  // Prefer windows explicitly tied to this menu; fall back to same-day globals.
  const forMenu = windows.filter((w) => w.menuId === menuId);
  const list = forMenu.length > 0 ? forMenu : windows;
  if (list.length === 0) return [];

  // One groupBy instead of N count queries (was a major menu/home lag source).
  const counts = await db.order.groupBy({
    by: ["deliveryWindowId"],
    where: {
      deliveryWindowId: { in: list.map((w) => w.id) },
      paymentStatus: { in: ["pending", "submitted", "paid"] },
      fulfillmentStatus: { not: "cancelled" },
    },
    _count: { _all: true },
  });
  const bookedByWindow = new Map(
    counts.map((row) => [row.deliveryWindowId, row._count._all]),
  );

  return list.map((window) => ({
    ...window,
    booked: bookedByWindow.get(window.id) ?? 0,
  }));
}

export function windowKey(date: Date): string {
  return manilaDateKey(date);
}
