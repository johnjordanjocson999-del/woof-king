import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { manilaStartOfDay } from "@/lib/time";
import type { MenuItem, Product, WeeklyMenu } from "@prisma/client";

/** A rotation must hold at least three products; upper bound is intentionally generous. */
export const MIN_MENU_ITEMS = 3;
export const MAX_MENU_ITEMS = 24;

/** Product fields the storefront + basket actually need (skip unused recipe/admin columns). */
const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  category: true,
  allergens: true,
  priceCentavos: true,
  sellingUnit: true,
  piecesPerUnit: true,
  storageNotes: true,
  shelfLifeNotes: true,
  imagePath: true,
  focalX: true,
  focalY: true,
  imageZoom: true,
  archived: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type StorefrontProduct = Pick<Product, keyof typeof productSelect>;
export type MenuItemWithProduct = MenuItem & { product: StorefrontProduct };
export type ActiveMenu = WeeklyMenu & { items: MenuItemWithProduct[] };

async function loadActiveMenu(nowMs: number): Promise<ActiveMenu | null> {
  const now = new Date(nowMs);
  const include = {
    items: {
      orderBy: { position: "asc" as const },
      where: { product: { archived: false } },
      include: { product: { select: productSelect } },
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
 * Request-deduped + cross-request cache (30s). Layout + home/menu share this.
 * Cache key buckets by ~minute so cutoff math stays honest enough for storefront.
 */
export const getActiveMenu = cache(async (now = new Date()): Promise<ActiveMenu | null> => {
  const bucket = Math.floor(now.getTime() / 30_000);
  return unstable_cache(() => loadActiveMenu(now.getTime()), ["wk-active-menu", String(bucket)], {
    revalidate: 30,
    tags: ["menu"],
  })();
});

export function remainingFor(item: MenuItem): number | null {
  if (item.quantityLimit <= 0) return null;
  return Math.max(0, item.quantityLimit - item.soldCount);
}

export function isSoldOut(item: MenuItem): boolean {
  const remaining = remainingFor(item);
  return remaining !== null && remaining <= 0;
}

export function ordersOpen(menu: ActiveMenu | null, now = new Date()): boolean {
  if (!menu) return false;
  return menu.status === "published" && now.getTime() <= menu.cutoffAt.getTime();
}

export function scarcityLabel(item: MenuItem): string | null {
  const remaining = remainingFor(item);
  if (remaining === null) return null;
  if (remaining <= 0) return "Sold out";
  if (remaining <= 5) return `Only ${remaining} left`;
  return null;
}
