import { db } from "@/lib/db";
import { parsePrepWeekdays, type WeeklySchedule } from "@/lib/time";
import type { Settings } from "@prisma/client";

/**
 * Settings is a single row. Reading it lazily creates it, so a fresh clone of
 * the repo boots without a seed step and the owner never meets an empty page.
 */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.settings.create({ data: { id: "singleton" } });
}

export function scheduleOf(settings: Settings): WeeklySchedule {
  return {
    cutoffWeekday: settings.cutoffWeekday,
    cutoffHour: settings.cutoffHour,
    cutoffMinute: settings.cutoffMinute,
    prepWeekdays: parsePrepWeekdays(settings.prepWeekdays),
    pickupWeekday: settings.pickupWeekday,
  };
}

export type VatMode = "none" | "inclusive" | "exclusive";

/**
 * VAT stays off until the owner ticks "VAT registered" in settings. A bakery
 * that is not registered must not print tax on a receipt, so the toggle gates
 * the mode rather than the mode standing alone.
 */
export function vatOf(settings: Settings): { mode: VatMode; rateBps: number } {
  if (!settings.vatRegistered) return { mode: "none", rateBps: 0 };
  return { mode: settings.vatMode as VatMode, rateBps: settings.vatRateBps };
}

export function paymentMethodsOf(settings: Settings): string[] {
  return settings.paymongoMethods
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}
