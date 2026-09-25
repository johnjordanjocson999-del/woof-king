"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { manilaStartOfDay, fromManila, manilaParts } from "@/lib/time";
import { parseTimeHHMM } from "@/domain/availability-helpers";

function revalidateAvailability() {
  revalidatePath("/admin/availability");
  revalidatePath("/admin/delivery");
  revalidatePath("/checkout");
  revalidatePath("/menu");
  revalidatePath("/", "layout");
}

function parseDateInput(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return fromManila(year, month, day, 0, 0);
}

/** Mark a day free by adding one time band (pickup, delivery, or both). */
export async function createAvailabilitySlot(formData: FormData): Promise<void> {
  await requireStaff();
  const dateRaw = String(formData.get("date") || "");
  const date = parseDateInput(dateRaw);
  if (!date) throw new Error("Pick a valid date.");

  const kind = String(formData.get("kind") || "both");
  if (!["pickup", "delivery", "both"].includes(kind)) {
    throw new Error("Kind must be pickup, delivery, or both.");
  }

  const start = String(formData.get("start") || "").trim();
  const end = String(formData.get("end") || "").trim();
  if (!parseTimeHHMM(start) || !parseTimeHHMM(end)) {
    throw new Error("Use 24-hour times like 09:00 and 11:00.");
  }
  if (start >= end) throw new Error("End time must be after start.");

  const capacity = Math.max(1, Math.min(200, Number(formData.get("capacity") || 10)));
  const label = String(formData.get("label") || "").trim().slice(0, 80);
  const notes = String(formData.get("notes") || "").trim().slice(0, 400);

  const day = manilaStartOfDay(date);
  const existing = await db.availabilitySlot.count({ where: { date: day } });

  await db.availabilitySlot.create({
    data: {
      date: day,
      kind,
      start,
      end,
      capacity,
      label:
        label ||
        (kind === "pickup" ? "Pickup" : kind === "delivery" ? "Delivery" : "Pickup / delivery"),
      notes,
      position: existing,
      active: true,
    },
  });

  revalidateAvailability();
}

/** Quick: open a day with morning + afternoon bands for both pickup and delivery. */
export async function openDayStandard(formData: FormData): Promise<void> {
  await requireStaff();
  const date = parseDateInput(String(formData.get("date") || ""));
  if (!date) throw new Error("Pick a valid date.");
  const day = manilaStartOfDay(date);
  const kind = String(formData.get("kind") || "both");
  if (!["pickup", "delivery", "both"].includes(kind)) {
    throw new Error("Invalid kind.");
  }

  const bands = [
    { start: "09:00", end: "11:00", label: "Morning" },
    { start: "15:00", end: "18:00", label: "Afternoon" },
  ];

  const existing = await db.availabilitySlot.findMany({ where: { date: day } });
  const existingKeys = new Set(existing.map((e) => `${e.kind}|${e.start}|${e.end}`));

  let position = existing.length;
  for (const band of bands) {
    const key = `${kind}|${band.start}|${band.end}`;
    if (existingKeys.has(key)) continue;
    await db.availabilitySlot.create({
      data: {
        date: day,
        kind,
        start: band.start,
        end: band.end,
        label: band.label,
        capacity: 12,
        position: position++,
        active: true,
      },
    });
  }

  revalidateAvailability();
}

export async function toggleAvailabilitySlot(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const row = await db.availabilitySlot.findUnique({ where: { id } });
  if (!row) return;
  await db.availabilitySlot.update({
    where: { id },
    data: { active: !row.active },
  });
  revalidateAvailability();
}

export async function deleteAvailabilitySlot(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const booked = await db.order.count({
    where: {
      availabilitySlotId: id,
      fulfillmentStatus: { not: "cancelled" },
    },
  });
  if (booked > 0) {
    await db.availabilitySlot.update({ where: { id }, data: { active: false } });
  } else {
    await db.availabilitySlot.delete({ where: { id } }).catch(() => {});
  }
  revalidateAvailability();
}

/** Close every slot on a calendar day (order-only again). */
export async function closeAvailabilityDay(formData: FormData): Promise<void> {
  await requireStaff();
  const date = parseDateInput(String(formData.get("date") || ""));
  if (!date) return;
  const day = manilaStartOfDay(date);
  await db.availabilitySlot.updateMany({
    where: { date: day },
    data: { active: false },
  });
  revalidateAvailability();
}

export async function monthLabelParts(date: Date) {
  const p = manilaParts(date);
  return p;
}
