import { applyVat, type Centavos } from "@/lib/money";
import type { CartState } from "@/lib/cart";
import { remainingFor, type ActiveMenu, type MenuItemWithProduct } from "@/domain/menu";
import type { Settings } from "@prisma/client";
import { vatOf } from "@/lib/settings";

export interface BasketLine {
  menuItemId: string;
  product: MenuItemWithProduct["product"];
  qty: number;
  unitPriceCentavos: Centavos;
  lineTotalCentavos: Centavos;
  /** null when the owner set no weekly cap. */
  remaining: number | null;
  /** Set when the requested quantity had to be trimmed or is unavailable. */
  issue?: string;
}

export interface BasketTotals {
  subtotalCentavos: Centavos;
  vatCentavos: Centavos;
  totalCentavos: Centavos;
  vatMode: "none" | "inclusive" | "exclusive";
  vatRateBps: number;
  itemCount: number;
}

export interface ResolvedBasket {
  lines: BasketLine[];
  totals: BasketTotals;
  /** Lines that vanished because the rotation changed under the customer. */
  droppedCount: number;
}

/**
 * Turns the cookie basket into priced lines against the live menu.
 *
 * Prices always come from the menu item, never from the cookie, so a stale or
 * tampered basket cannot buy bread at a price the owner did not set. Quantities
 * are clamped to what is still available here as well as at checkout, because
 * two people can be on the last loaf at the same time.
 */
export function resolveBasket(
  cart: CartState,
  menu: ActiveMenu | null,
  settings: Settings,
): ResolvedBasket {
  const vat = vatOf(settings);

  if (!menu) {
    return {
      lines: [],
      totals: {
        subtotalCentavos: 0,
        vatCentavos: 0,
        totalCentavos: 0,
        vatMode: vat.mode,
        vatRateBps: vat.rateBps,
        itemCount: 0,
      },
      droppedCount: cart.lines.length,
    };
  }

  const byId = new Map(menu.items.map((item) => [item.id, item]));
  const lines: BasketLine[] = [];
  let dropped = 0;

  for (const cartLine of cart.lines) {
    const item = byId.get(cartLine.menuItemId);
    if (!item || item.product.archived) {
      dropped += 1;
      continue;
    }

    const remaining = remainingFor(item);
    let qty = cartLine.qty;
    let issue: string | undefined;

    if (remaining !== null && remaining <= 0) {
      issue = "Sold out for this week";
      qty = 0;
    } else if (remaining !== null && qty > remaining) {
      issue = `Only ${remaining} left, so we trimmed this line`;
      qty = remaining;
    }

    lines.push({
      menuItemId: item.id,
      product: item.product,
      qty,
      unitPriceCentavos: item.priceCentavos,
      lineTotalCentavos: item.priceCentavos * qty,
      remaining,
      issue,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCentavos, 0);
  const applied = applyVat(subtotal, vat.mode, vat.rateBps);

  return {
    lines,
    totals: {
      subtotalCentavos: vat.mode === "inclusive" ? applied.base : subtotal,
      vatCentavos: applied.vat,
      totalCentavos: applied.total,
      vatMode: vat.mode,
      vatRateBps: vat.rateBps,
      itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
    },
    droppedCount: dropped,
  };
}

/** True when the basket has at least one line that can actually be paid for. */
export function isBasketPayable(basket: ResolvedBasket): boolean {
  return basket.lines.some((line) => line.qty > 0) && basket.totals.totalCentavos > 0;
}
