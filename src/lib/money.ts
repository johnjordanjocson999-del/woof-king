/**
 * Every peso amount in this app is an integer count of centavos.
 *
 * Floats are never used for money: 0.1 + 0.2 !== 0.3, and a bakery that sells
 * 300 pieces a week would drift by real pesos within a month.
 */

export type Centavos = number;

export function pesos(amount: number): Centavos {
  return Math.round(amount * 100);
}

/** "₱180.00" */
export function formatPeso(centavos: Centavos, options?: { withSymbol?: boolean }): string {
  const withSymbol = options?.withSymbol ?? true;
  const negative = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const whole = Math.floor(abs / 100).toLocaleString("en-PH");
  const cents = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${withSymbol ? "₱" : ""}${whole}.${cents}`;
}

/** "₱180" when the amount is whole pesos, "₱180.50" when it is not. */
export function formatPesoShort(centavos: Centavos): string {
  return centavos % 100 === 0
    ? `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`
    : formatPeso(centavos);
}

/** Basis points so a 12% VAT rate is the exact integer 1200, not 0.12. */
export function percentBps(centavos: Centavos, bps: number): Centavos {
  return Math.round((centavos * bps) / 10_000);
}

/**
 * VAT split.
 *
 * `exclusive` adds tax on top of the price shown. `inclusive` means the shelf
 * price already contains it, so tax is backed out rather than added, and the
 * customer's total does not move.
 */
export function applyVat(
  net: Centavos,
  mode: "none" | "inclusive" | "exclusive",
  rateBps: number,
): { base: Centavos; vat: Centavos; total: Centavos } {
  if (mode === "none" || rateBps <= 0) return { base: net, vat: 0, total: net };
  if (mode === "exclusive") {
    const vat = percentBps(net, rateBps);
    return { base: net, vat, total: net + vat };
  }
  const base = Math.round((net * 10_000) / (10_000 + rateBps));
  return { base, vat: net - base, total: net };
}

/** Parses "180", "180.50" or "₱1,180.50" from an admin form into centavos. */
export function parsePesoInput(raw: string): Centavos {
  const cleaned = raw.replace(/[₱,\s]/g, "").trim();
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Enter a peso amount like 180 or 180.50");
  }
  return Math.round(value * 100);
}
