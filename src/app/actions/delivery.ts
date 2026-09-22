"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fromManila, manilaStartOfDay } from "@/lib/time";

function revalidateDelivery() {
  revalidatePath("/admin/delivery");
  revalidatePath("/checkout");
  revalidatePath("/menu");
  revalidatePath("/", "layout");
}

function parseTime(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parses an HTML date input (YYYY-MM-DD) as Manila midnight. */
function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return fromManila(year, month, day, 0, 0);
}

export async function createDeliveryWindow(formData: FormData): Promise<void> {
  await requireStaff();

  const menuId = String(formData.get("menuId") || "").trim() || null;
  const label = String(formData.get("label") || "").trim() || "Delivery window";
  const date = parseDateInput(String(formData.get("date") || ""));
  const start = parseTime(String(formData.get("start") || ""));
  const end = parseTime(String(formData.get("end") || ""));
  const capacity = Math.max(1, Number(formData.get("capacity") || 15));
  const notes = String(formData.get("notes") || "").trim();

  if (!date) throw new Error("Pick a delivery date.");
  if (!start || !end) throw new Error("Start and end times are required (HH:MM).");
  if (start >= end) throw new Error("End time must be after start time.");

  if (menuId) {
    const menu = await db.weeklyMenu.findUnique({ where: { id: menuId } });
    if (!menu) throw new Error("That weekly menu was not found.");
  }

  const last = await db.deliveryWindow.findFirst({
    where: { menuId },
    orderBy: { position: "desc" },
  });

  await db.deliveryWindow.create({
    data: {
      menuId,
      date: manilaStartOfDay(date),
      start,
      end,
      label,
      capacity,
      notes,
      position: (last?.position ?? -1) + 1,
      active: true,
    },
  });

  revalidateDelivery();
}

export async function toggleDeliveryWindow(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing window.");
  const window = await db.deliveryWindow.findUnique({ where: { id } });
  if (!window) throw new Error("Window not found.");
  await db.deliveryWindow.update({
    where: { id },
    data: { active: !window.active },
  });
  revalidateDelivery();
}

export async function deleteDeliveryWindow(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing window.");
  await db.deliveryWindow.delete({ where: { id } });
  revalidateDelivery();
}

/** Fills Sat/Sun 9–11 and 3–6 for the selected weekly menu (replaces empty slots). */
export async function fillStandardDeliveryWindows(formData: FormData): Promise<void> {
  await requireStaff();
  const menuId = String(formData.get("menuId") || "").trim();
  if (!menuId) throw new Error("Pick a weekly menu.");
  const menu = await db.weeklyMenu.findUnique({ where: { id: menuId } });
  if (!menu) throw new Error("That weekly menu was not found.");

  const { ensureStandardDeliveryWindows } = await import("@/domain/delivery");
  await ensureStandardDeliveryWindows(menuId, menu.pickupDate, { replace: true });
  revalidateDelivery();
}
