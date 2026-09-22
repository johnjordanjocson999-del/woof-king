"use server";

import { revalidatePath } from "next/cache";
import { addLine, readCart, setLineQty, writeCart } from "@/lib/cart";
import { getActiveMenu, ordersOpen, remainingFor } from "@/domain/menu";

/**
 * Basket mutations.
 *
 * Every one of these re-checks the live menu. The cookie is user-controlled, so
 * it is treated as a request, never as a fact: the menu decides what exists,
 * what it costs, and how many are left.
 */

export interface CartActionResult {
  ok: boolean;
  message?: string;
}

export async function addToBasket(
  menuItemId: string,
  qty: number,
): Promise<CartActionResult> {
  const menu = await getActiveMenu();
  if (!ordersOpen(menu)) {
    return { ok: false, message: "Orders for this week have closed." };
  }

  const item = menu?.items.find((candidate) => candidate.id === menuItemId);
  if (!item) return { ok: false, message: "That item is not on this week's menu." };

  const remaining = remainingFor(item);
  if (remaining !== null && remaining <= 0) {
    return { ok: false, message: `${item.product.name} is sold out for this week.` };
  }

  const cart = await readCart();
  const alreadyInBasket = cart.lines.find((line) => line.menuItemId === menuItemId)?.qty ?? 0;
  const requested = Math.max(1, Math.trunc(qty));

  if (remaining !== null && alreadyInBasket + requested > remaining) {
    const canAdd = remaining - alreadyInBasket;
    if (canAdd <= 0) {
      return { ok: false, message: `You already have all ${remaining} remaining in your basket.` };
    }
    await writeCart(addLine(cart, menuItemId, canAdd));
    revalidatePath("/", "layout");
    return { ok: true, message: `Only ${remaining} left this week, so we added ${canAdd}.` };
  }

  await writeCart(addLine(cart, menuItemId, requested));
  revalidatePath("/", "layout");
  return { ok: true, message: `${item.product.name} added to your basket.` };
}

export async function setBasketQuantity(
  menuItemId: string,
  qty: number,
): Promise<CartActionResult> {
  const cart = await readCart();

  // Zero is a valid request: it is how the stepper's minus button removes a line.
  if (qty <= 0) {
    await writeCart(setLineQty(cart, menuItemId, 0));
    revalidatePath("/", "layout");
    return { ok: true, message: "Removed." };
  }

  const menu = await getActiveMenu();
  if (!ordersOpen(menu)) {
    return { ok: false, message: "Orders for this week have closed." };
  }

  const item = menu?.items.find((candidate) => candidate.id === menuItemId);
  if (!item) return { ok: false, message: "That item is no longer available." };

  const remaining = remainingFor(item);
  const capped = remaining === null ? qty : Math.min(qty, remaining);

  await writeCart(setLineQty(cart, menuItemId, capped));
  revalidatePath("/", "layout");

  return capped < qty
    ? { ok: true, message: `Only ${remaining} left this week.` }
    : { ok: true };
}

export async function removeFromBasket(menuItemId: string): Promise<CartActionResult> {
  const cart = await readCart();
  await writeCart(setLineQty(cart, menuItemId, 0));
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed." };
}
