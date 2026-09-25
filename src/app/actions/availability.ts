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

/** Read one or many dates from form (`date` or repeated `dates`). */
function parseDatesFromForm(formData: FormData): Date[] {
  const many = formData
    .getAll("dates")
    .map(String)
    .flatMap((s) => s.split(/[,\s]+/))
    .map((s) => s.trim())
    .filter(Boolean);
  const single = String(formData.get("date") || "").trim();
  const raw = many.length > 0 ? many : single ? [single] : [];
  const out: Date[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const d = parseDateInput(r);
    if (!d) continue;
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(manilaStartOfDay(d));
  }
  return out;
}

type BandInput = {
  start: string;
  end: string;
  label: string;
  capacity: number;
  notes: string;
};

function readBandsFromForm(formData: FormData): BandInput[] {
  const starts = formData.getAll("start").map(String);
  const ends = formData.getAll("end").map(String);
  const labels = formData.getAll("label").map(String);
  const capacities = formData.getAll("capacity").map(String);
  const notesList = formData.getAll("notes").map(String);

  if (starts.length === 0) {
    const start = String(formData.get("start") || "").trim();
    const end = String(formData.get("end") || "").trim();
    if (!start && !end) return [];
    return [
      {
        start,
        end,
        label: String(formData.get("label") || "").trim().slice(0, 80),
        capacity: Math.max(1, Math.min(200, Number(formData.get("capacity") || 10))),
        notes: String(formData.get("notes") || "").trim().slice(0, 400),
      },
    ];
  }

  const bands: BandInput[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]?.trim() ?? "";
    const end = ends[i]?.trim() ?? "";
    if (!start && !end) continue;
    bands.push({
      start,
      end,
      label: (labels[i] || "").trim().slice(0, 80),
      capacity: Math.max(1, Math.min(200, Number(capacities[i] || 10))),
      notes: (notesList[i] || "").trim().slice(0, 400),
    });
  }
  return bands;
}

function validateBand(band: BandInput) {
  if (!parseTimeHHMM(band.start) || !parseTimeHHMM(band.end)) {
    throw new Error("Use 24-hour times like 09:00 and 11:00.");
  }
  if (band.start >= band.end) throw new Error("End time must be after start.");
}

async function createBandsOnDays(days: Date[], kind: string, bands: BandInput[]) {
  for (const day of days) {
    const existing = await db.availabilitySlot.findMany({ where: { date: day } });
    const existingKeys = new Set(existing.map((e) => `${e.kind}|${e.start}|${e.end}`));
    let position = existing.length;

    for (const band of bands) {
      validateBand(band);
      const key = `${kind}|${band.start}|${band.end}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      await db.availabilitySlot.create({
        data: {
          date: day,
          kind,
          start: band.start,
          end: band.end,
          capacity: band.capacity,
          label:
            band.label ||
            (kind === "pickup"
              ? "Pickup"
              : kind === "delivery"
                ? "Delivery"
                : "Pickup / delivery"),
          notes: band.notes,
          position: position++,
          active: true,
        },
      });
    }
  }
}

/** Mark day(s) free by adding one or more time bands. */
export async function createAvailabilitySlot(formData: FormData): Promise<void> {
  await requireStaff();
  const days = parseDatesFromForm(formData);
  if (days.length === 0) throw new Error("Pick at least one date.");

  const kind = String(formData.get("kind") || "both");
  if (!["pickup", "delivery", "both"].includes(kind)) {
    throw new Error("Kind must be pickup, delivery, or both.");
  }

  const bands = readBandsFromForm(formData);
  if (bands.length === 0) throw new Error("Add at least one time band.");

  await createBandsOnDays(days, kind, bands);
  revalidateAvailability();
}

/** Quick: open day(s) with morning + afternoon bands. */
export async function openDayStandard(formData: FormData): Promise<void> {
  await requireStaff();
  const days = parseDatesFromForm(formData);
  if (days.length === 0) throw new Error("Pick at least one date.");

  const kind = String(formData.get("kind") || "both");
  if (!["pickup", "delivery", "both"].includes(kind)) {
    throw new Error("Invalid kind.");
  }

  const bands: BandInput[] = [
    { start: "09:00", end: "11:00", label: "Morning", capacity: 12, notes: "" },
    { start: "15:00", end: "18:00", label: "Afternoon", capacity: 12, notes: "" },
  ];

  await createBandsOnDays(days, kind, bands);
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

/** Close every slot on one or more calendar days (order-only again). */
export async function closeAvailabilityDay(formData: FormData): Promise<void> {
  await requireStaff();
  const days = parseDatesFromForm(formData);
  if (days.length === 0) return;
  await db.availabilitySlot.updateMany({
    where: { date: { in: days } },
    data: { active: false },
  });
  revalidateAvailability();
}

export async function monthLabelParts(date: Date) {
  const p = manilaParts(date);
  return p;
}
