import { cookies } from "next/headers";

/**
 * The basket lives in a cookie, not the database.
 *
 * A customer must be able to fill a basket and check out without ever making an
 * account, and an abandoned basket should cost nothing to store. Lines are keyed
 * by weekly menu item rather than by product, so when a new rotation is
 * published the old basket resolves to nothing instead of silently selling last
 * week's bread at last week's price.
 */

const COOKIE = "wk_basket";
const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 50;

export interface CartLine {
  menuItemId: string;
  qty: number;
}

export interface CartState {
  lines: CartLine[];
}

const EMPTY: CartState = { lines: [] };

function sanitise(value: unknown): CartState {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = (value as { lines?: unknown }).lines;
  if (!Array.isArray(raw)) return EMPTY;

  const lines: CartLine[] = [];
  for (const entry of raw.slice(0, MAX_LINES)) {
    if (!entry || typeof entry !== "object") continue;
    const { menuItemId, qty } = entry as { menuItemId?: unknown; qty?: unknown };
    if (typeof menuItemId !== "string" || menuItemId.length === 0) continue;
    const quantity = Math.trunc(Number(qty));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (lines.some((line) => line.menuItemId === menuItemId)) continue;
    lines.push({ menuItemId, qty: Math.min(quantity, MAX_QTY_PER_LINE) });
  }
  return { lines };
}

export async function readCart(): Promise<CartState> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return EMPTY;
  try {
    return sanitise(JSON.parse(raw));
  } catch {
    // A corrupted cookie must not break the storefront; treat it as empty.
    return EMPTY;
  }
}

export async function writeCart(state: CartState): Promise<void> {
  const jar = await cookies();
  const clean = sanitise(state);
  if (clean.lines.length === 0) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, JSON.stringify(clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearCart(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Adds to an existing line rather than creating a duplicate. */
export function addLine(state: CartState, menuItemId: string, qty: number): CartState {
  const lines = [...state.lines];
  const existing = lines.findIndex((line) => line.menuItemId === menuItemId);
  if (existing >= 0) {
    lines[existing] = {
      ...lines[existing],
      qty: Math.min(MAX_QTY_PER_LINE, lines[existing].qty + qty),
    };
  } else {
    lines.push({ menuItemId, qty: Math.min(MAX_QTY_PER_LINE, qty) });
  }
  return { lines };
}

/** Quantity 0 removes the line, which is what the stepper's minus button relies on. */
export function setLineQty(state: CartState, menuItemId: string, qty: number): CartState {
  if (qty <= 0) {
    return { lines: state.lines.filter((line) => line.menuItemId !== menuItemId) };
  }
  return {
    lines: state.lines.map((line) =>
      line.menuItemId === menuItemId
        ? { ...line, qty: Math.min(MAX_QTY_PER_LINE, Math.trunc(qty)) }
        : line,
    ),
  };
}

export function cartCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.qty, 0);
}
