import { db } from "@/lib/db";
import { manilaStartOfDay } from "@/lib/time";
import type { MenuItem, Product, WeeklyMenu } from "@prisma/client";

/** A rotation must hold at least three products; upper bound is intentionally generous. */
export const MIN_MENU_ITEMS = 3;
export const MAX_MENU_ITEMS = 24;

export type MenuItemWithProduct = MenuItem & { product: Product };
export type ActiveMenu = WeeklyMenu & { items: MenuItemWithProduct[] };

/**
 * The rotation the storefront is currently showing.
 *
 * Prefer the soonest published pickup that has not already passed (so the site
 * keeps showing this week through the Friday/Saturday bake). If that query is
 * empty — timezone edge, clock skew, or a just-closed Sunday — fall back to the
 * latest published menu so the table never blanks out with no explanation.
 */
export async function getActiveMenu(now = new Date()): Promise<ActiveMenu | null> {
  const include = {
    items: {
      orderBy: { position: "asc" as const },
      include: { product: true },
      where: { product: { archived: false } },
    },
  };

  const upcoming = await db.weeklyMenu.findFirst({
    where: { status: "published", pickupDate: { gte: manilaStartOfDay(now) } },
    orderBy: { pickupDate: "asc" },
    include,
  });
  if (upcoming) return upcoming;

  return db.weeklyMenu.findFirst({
    where: { status: "published" },
    orderBy: { pickupDate: "desc" },
    include,
  });
}

/**
 * How many of an item are still sellable. A `quantityLimit` of 0 means the owner
 * set no cap for the week.
 */
export function remainingFor(item: MenuItem): number | null {
  if (item.quantityLimit <= 0) return null;
  return Math.max(0, item.quantityLimit - item.soldCount);
}

export function isSoldOut(item: MenuItem): boolean {
  const remaining = remainingFor(item);
  return remaining !== null && remaining <= 0;
}

/** Ordering is open only while the menu is published and the cutoff is ahead. */
export function ordersOpen(menu: ActiveMenu | null, now = new Date()): boolean {
  if (!menu) return false;
  return menu.status === "published" && now.getTime() <= menu.cutoffAt.getTime();
}

/**
 * Low-stock nudge for the storefront. Showing "only 4 left" is honest scarcity
 * when the number is real, so it is only rendered from an actual cap.
 */
export function scarcityLabel(item: MenuItem): string | null {
  const remaining = remainingFor(item);
  if (remaining === null) return null;
  if (remaining <= 0) return "Sold out";
  if (remaining <= 5) return `Only ${remaining} left`;
  return null;
}
