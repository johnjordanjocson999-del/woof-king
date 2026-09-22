import { Decimal, convertToBase, type BaseUnit } from "@/lib/units";
import { percentBps, type Centavos } from "@/lib/money";
import type { Ingredient, Overhead, Recipe, RecipeLine } from "@prisma/client";

/**
 * Costing for a single sellable unit.
 *
 * The cupcake question, answered in numbers: a 24-piece batch that uses 480 g
 * of flour costs 20 g of flour per piece. That division is `qtyBase /
 * yieldPieces`, and it is the only place ingredient usage is calculated.
 */

export type RecipeLineWithIngredient = RecipeLine & { ingredient: Ingredient };

export interface LineUsage {
  ingredientId: string;
  name: string;
  kind: "ingredient" | "packaging";
  qtyBase: string;
  qtyPerPieceBase: string;
  costPerBaseCentavos: string;
  costPerPieceCentavos: Centavos;
  baseUnit: BaseUnit;
}

export interface PieceCost {
  lines: LineUsage[];
  ingredientPerPiece: Centavos;
  packagingPerPiece: Centavos;
  laborPerPiece: Centavos;
  overheadPerPiece: Centavos;
  estimatedFee: Centavos;
  estimatedCost: Centavos;
  sellingPrice: Centavos;
  estimatedProfit: Centavos;
  estimatedMargin: number;
  estimatedMarkup: number;
}

export function recipeLinesToBase(
  lines: RecipeLineWithIngredient[],
): Array<{ line: RecipeLineWithIngredient; qtyBase: Decimal }> {
  return lines.map((line) => {
    const qtyBase = convertToBase(
      line.qty,
      line.unit,
      line.ingredient.baseUnit as BaseUnit,
      { [line.ingredient.purchaseUnit.toLowerCase()]: line.ingredient.purchaseToBase },
    );
    return { line, qtyBase };
  });
}

export function usagePerPiece(qtyBase: Decimal | string, yieldPieces: number): Decimal {
  if (yieldPieces <= 0) throw new Error("Batch yield must be greater than zero");
  return new Decimal(qtyBase.toString()).div(yieldPieces);
}

export function batchIngredientCost(
  lines: Array<{ qtyBase: string; costPerBaseCentavos: string }>,
): Centavos {
  return lines.reduce((sum, line) => {
    const cost = new Decimal(line.qtyBase).mul(line.costPerBaseCentavos);
    return sum + Math.round(Number(cost.toFixed(4)));
  }, 0);
}

export function allocatedOverheadPerUnit(entry: Overhead): Centavos {
  const pool =
    entry.electricityCentavos +
    entry.gasCentavos +
    entry.waterCentavos +
    entry.rentCentavos +
    entry.otherCentavos;
  if (entry.allocationBasis === "hours") {
    if (entry.expectedHours <= 0) return 0;
    return Math.round(pool / entry.expectedHours);
  }
  if (entry.expectedUnits <= 0) return 0;
  return Math.round(pool / entry.expectedUnits);
}

export function productCostBreakdown(input: {
  recipe: Recipe;
  lines: RecipeLineWithIngredient[];
  sellingPrice: Centavos;
  estimatedFeeBps: number;
  overhead?: Overhead | null;
}): PieceCost {
  const yieldPieces = input.recipe.yieldPieces;
  const converted = recipeLinesToBase(input.lines);

  const usages: LineUsage[] = converted.map(({ line, qtyBase }) => {
    const perPiece = usagePerPiece(qtyBase, yieldPieces);
    const costPerPiece = Math.round(
      Number(perPiece.mul(line.ingredient.costPerBaseCentavos).toFixed(4)),
    );
    return {
      ingredientId: line.ingredientId,
      name: line.ingredient.name,
      kind: (line.kind as "ingredient" | "packaging") ?? "ingredient",
      qtyBase: qtyBase.toString(),
      qtyPerPieceBase: perPiece.toString(),
      costPerBaseCentavos: line.ingredient.costPerBaseCentavos,
      costPerPieceCentavos: costPerPiece,
      baseUnit: line.ingredient.baseUnit as BaseUnit,
    };
  });

  const ingredientPerPiece = usages
    .filter((u) => u.kind === "ingredient")
    .reduce((s, u) => s + u.costPerPieceCentavos, 0);
  const packagingPerPiece = usages
    .filter((u) => u.kind === "packaging")
    .reduce((s, u) => s + u.costPerPieceCentavos, 0);

  const laborPerPiece = Math.round(input.recipe.laborCentavos / Math.max(1, yieldPieces));

  let overheadPerPiece = 0;
  if (input.overhead) {
    const per = allocatedOverheadPerUnit(input.overhead);
    overheadPerPiece =
      input.overhead.allocationBasis === "hours"
        ? Math.round((per * input.recipe.ovenMinutes) / 60)
        : per;
  }

  const estimatedFee = percentBps(input.sellingPrice, input.estimatedFeeBps);
  const estimatedCost =
    ingredientPerPiece + packagingPerPiece + laborPerPiece + overheadPerPiece + estimatedFee;
  const estimatedProfit = input.sellingPrice - estimatedCost;
  const estimatedMargin = input.sellingPrice === 0 ? 0 : estimatedProfit / input.sellingPrice;
  const estimatedMarkup = estimatedCost === 0 ? 0 : estimatedProfit / estimatedCost;

  return {
    lines: usages,
    ingredientPerPiece,
    packagingPerPiece,
    laborPerPiece,
    overheadPerPiece,
    estimatedFee,
    estimatedCost,
    sellingPrice: input.sellingPrice,
    estimatedProfit,
    estimatedMargin,
    estimatedMarkup,
  };
}
