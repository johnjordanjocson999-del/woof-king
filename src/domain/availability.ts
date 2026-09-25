import { db } from "@/lib/db";
import { addDays, manilaDateKey, manilaStartOfDay } from "@/lib/time";
import type { AvailabilityKind, AvailabilitySlotView } from "@/domain/availability-types";

export type { AvailabilityKind, AvailabilitySlotView } from "@/domain/availability-types";
export { openDateKeys, slotsForDate, parseTimeHHMM } from "@/domain/availability-helpers";

function matchesFulfillment(kind: string, fulfillment: "pickup" | "delivery"): boolean {
  if (kind === "both") return true;
  return kind === fulfillment;
}

async function bookedBySlotIds(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.order.groupBy({
    by: ["availabilitySlotId"],
    where: {
      availabilitySlotId: { in: ids },
      paymentStatus: { in: ["pending", "submitted", "paid"] },
      fulfillmentStatus: { not: "cancelled" },
    },
    _count: { _all: true },
  });
  return new Map(
    rows
      .filter((r) => r.availabilitySlotId)
      .map((r) => [r.availabilitySlotId as string, r._count._all]),
  );
}

/**
 * Upcoming free slots from today forward (default 60 days).
 */
export async function listAvailabilitySlots(options?: {
  from?: Date;
  to?: Date;
  fulfillment?: "pickup" | "delivery";
  onlyActive?: boolean;
}): Promise<AvailabilitySlotView[]> {
  const from = manilaStartOfDay(options?.from ?? new Date());
  const to = manilaStartOfDay(options?.to ?? addDays(from, 60));
  const onlyActive = options?.onlyActive ?? true;

  const rows = await db.availabilitySlot.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(onlyActive ? { active: true } : {}),
      ...(options?.fulfillment
        ? {
            OR: [{ kind: options.fulfillment }, { kind: "both" }],
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { start: "asc" }, { position: "asc" }],
  });

  const booked = await bookedBySlotIds(rows.map((r) => r.id));

  return rows
    .filter((r) =>
      options?.fulfillment ? matchesFulfillment(r.kind, options.fulfillment) : true,
    )
    .map((r) => ({
      id: r.id,
      dateIso: r.date.toISOString(),
      dateKey: manilaDateKey(r.date),
      kind: r.kind as AvailabilityKind,
      label: r.label,
      start: r.start,
      end: r.end,
      capacity: r.capacity,
      booked: booked.get(r.id) ?? 0,
      active: r.active,
    }));
}
