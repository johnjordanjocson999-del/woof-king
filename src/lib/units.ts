import Decimal from "decimal.js";

/**
 * Unit conversion for raw materials.
 *
 * Every ingredient lives in exactly one base unit: grams for solids,
 * millilitres for liquids, pieces for things you count. Bakers do not think in
 * base units though: a recipe says "3 cups flour", a receipt says "1 sack", a
 * hydration note says "0.35 L water". Those all have to land on the same
 * number before any cost or stock figure can be trusted.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type BaseUnit = "g" | "ml" | "piece";

export const BASE_UNITS: { id: BaseUnit; label: string; help: string }[] = [
  { id: "g", label: "Grams (g)", help: "Flour, sugar, butter, salt, yeast" },
  { id: "ml", label: "Millilitres (ml)", help: "Water, milk, oil, extracts" },
  { id: "piece", label: "Pieces", help: "Eggs, boxes, paper cups, labels" },
];

/** Fixed factors into the base unit. Mass and volume never mix here. */
const MASS_TO_G: Record<string, string> = {
  g: "1",
  gram: "1",
  grams: "1",
  kg: "1000",
  kilo: "1000",
  kilos: "1000",
  kilogram: "1000",
  mg: "0.001",
  oz: "28.349523125",
  lb: "453.59237",
  lbs: "453.59237",
};

const VOLUME_TO_ML: Record<string, string> = {
  ml: "1",
  millilitre: "1",
  milliliter: "1",
  cl: "10",
  dl: "100",
  l: "1000",
  li: "1000",
  liter: "1000",
  litre: "1000",
  liters: "1000",
  litres: "1000",
  tsp: "5",
  teaspoon: "5",
  tbsp: "15",
  tablespoon: "15",
  cup: "240",
  cups: "240",
  "fl oz": "29.5735295625",
};

const COUNT_UNITS: Record<string, string> = {
  piece: "1",
  pieces: "1",
  pc: "1",
  pcs: "1",
  each: "1",
  dozen: "12",
  doz: "12",
  tray: "30",
};

/**
 * Cooking measures for dry goods. A cup of flour is not a cup of water, so
 * volume-to-mass needs a density per ingredient class. These are the standard
 * King Arthur / USDA figures and are the ones a baker will recognise.
 */
export const DRY_VOLUME_TO_G: Record<string, Record<string, string>> = {
  flour: { cup: "120", tbsp: "7.5", tsp: "2.5" },
  sugar: { cup: "200", tbsp: "12.5", tsp: "4.2" },
  "brown sugar": { cup: "213", tbsp: "13.3", tsp: "4.4" },
  butter: { cup: "227", tbsp: "14.2", tsp: "4.7" },
  cocoa: { cup: "85", tbsp: "5.3", tsp: "1.8" },
  salt: { cup: "273", tbsp: "17", tsp: "5.7" },
  yeast: { cup: "150", tbsp: "9.4", tsp: "3.1" },
};

export class UnitError extends Error {}

function normalise(unit: string): string {
  return unit.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Units the owner may pick for a recipe line or a purchase, given the
 * ingredient's base unit. Keeps the dropdown honest: you cannot log litres of
 * flour unless a density is configured for it.
 */
export function allowedUnitsFor(baseUnit: BaseUnit, customKeys: string[] = []): string[] {
  const base: Record<BaseUnit, string[]> = {
    g: ["g", "kg", "oz", "lb"],
    ml: ["ml", "l", "tsp", "tbsp", "cup"],
    piece: ["piece", "dozen", "tray"],
  };
  return [...base[baseUnit], ...customKeys];
}

/**
 * Converts `qty unit` into the ingredient's base unit.
 *
 * `custom` carries per-ingredient factors, which is how "1 sack = 25000 g" or a
 * flour density for cups gets expressed. Custom entries win over the built-in
 * tables so an owner can always override.
 */
export function convertToBase(
  qty: string | number,
  unit: string,
  baseUnit: BaseUnit,
  custom: Record<string, string> = {},
): Decimal {
  const amount = new Decimal(String(qty ?? "0"));
  if (amount.isNegative()) throw new UnitError("Quantity cannot be negative");
  const key = normalise(unit);

  const customFactor = custom[key] ?? custom[unit];
  if (customFactor) return amount.mul(new Decimal(customFactor));

  if (baseUnit === "g") {
    if (MASS_TO_G[key]) return amount.mul(new Decimal(MASS_TO_G[key]));
    throw new UnitError(
      `"${unit}" is a volume, and this ingredient is measured by weight. Add a custom conversion (for example 1 cup = 120 g) or enter grams.`,
    );
  }

  if (baseUnit === "ml") {
    if (VOLUME_TO_ML[key]) return amount.mul(new Decimal(VOLUME_TO_ML[key]));
    throw new UnitError(`"${unit}" is not a volume this app knows. Use ml, l, tsp, tbsp or cup.`);
  }

  if (COUNT_UNITS[key]) return amount.mul(new Decimal(COUNT_UNITS[key]));
  throw new UnitError(`"${unit}" cannot be counted in pieces. Use piece, dozen or tray.`);
}

/** Base units back into a purchase unit, for the restock shopping list. */
export function baseToPurchase(qtyBase: string | Decimal, purchaseToBase: string): Decimal {
  const factor = new Decimal(purchaseToBase);
  if (factor.lte(0)) throw new UnitError("Purchase-to-base factor must be greater than zero");
  return new Decimal(qtyBase.toString()).div(factor);
}

/**
 * Human-readable stock figure. 25 000 g reads as "25 kg", not as five digits
 * the owner has to divide in their head.
 */
export function formatBase(qtyBase: string | Decimal, baseUnit: BaseUnit): string {
  const value = new Decimal(qtyBase.toString());
  if (baseUnit === "piece") {
    return `${trim(value)} ${value.abs().eq(1) ? "pc" : "pcs"}`;
  }
  if (baseUnit === "g") {
    return value.abs().gte(1000) ? `${trim(value.div(1000), 3)} kg` : `${trim(value)} g`;
  }
  return value.abs().gte(1000) ? `${trim(value.div(1000), 3)} L` : `${trim(value)} ml`;
}

function trim(value: Decimal, dp = 2): string {
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toString();
}

/** Parses a per-ingredient conversion table stored as JSON text. */
export function parseCustomConversions(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // A malformed override should degrade to "no overrides", never crash a page.
  }
  return {};
}
