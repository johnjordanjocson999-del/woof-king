import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { parsePrepWeekdays, type WeeklySchedule } from "@/lib/time";
import type { Settings } from "@prisma/client";

/** `unstable_cache` JSON-serializes Dates to strings — restore them after a hit. */
function reviveSettings(row: Settings): Settings {
  return {
    ...row,
    updatedAt: new Date(row.updatedAt),
  };
}

async function loadSettings(): Promise<Settings> {
  const existing = await db.settings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.settings.create({ data: { id: "singleton" } });
}

/**
 * Deduped within a request + cached across requests (60s).
 * Storefront layout hits this on every navigation — must stay cheap.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const row = await unstable_cache(loadSettings, ["wk-settings"], {
    revalidate: 60,
    tags: ["settings"],
  })();
  return reviveSettings(row);
});

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
