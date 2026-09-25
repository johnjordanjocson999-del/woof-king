import { Decimal, convertToBase, baseToPurchase, type BaseUnit } from "@/lib/units";
import type { Ingredient, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Inventory: purchases raise stock, production is the only place ingredients
 * leave it. Orders never touch raw materials directly — that double-counting
 * trap is exactly what this module exists to avoid.
 */

type Tx = Prisma.TransactionClient;

export async function receivePurchaseItem(
  tx: Tx,
  input: {
    ingredient: Ingredient;
    qty: string;
    unit: string;
    lineTotalCentavos: number;
    purchaseId: string;
    actorUserId?: string;
  },
) {
  const qtyBase = convertToBase(
    input.qty,
    input.unit,
    input.ingredient.baseUnit as BaseUnit,
    { [input.ingredient.purchaseUnit.toLowerCase()]: input.ingredient.purchaseToBase },
  );

  const onHand = new Decimal(input.ingredient.qtyOnHandBase);
  const oldCost = new Decimal(input.ingredient.costPerBaseCentavos);
  const lineCost = new Decimal(input.lineTotalCentavos);
  // Moving average: (oldStock * oldCost + newStock * newCost) / newTotal.
  // Buying a cheaper sack should not erase the cost of what is already on the shelf.
  const newOnHand = onHand.add(qtyBase);
  const newCost =
    newOnHand.lte(0)
      ? oldCost
      : onHand.mul(oldCost).add(lineCost).div(newOnHand);

  await tx.ingredient.update({
    where: { id: input.ingredient.id },
    data: {
      qtyOnHandBase: newOnHand.toString(),
      costPerBaseCentavos: newCost.toDecimalPlaces(6).toString(),
    },
  });

  await tx.stockMovement.create({
    data: {
      type: "purchase_received",
      ingredientId: input.ingredient.id,
      qtyBase: qtyBase.toString(),
      unitCostCentavos: qtyBase.gt(0)
        ? lineCost.div(qtyBase).toDecimalPlaces(6).toString()
        : "0",
      reason: `Purchase ${input.purchaseId}`,
      refId: input.purchaseId,
      actorUserId: input.actorUserId,
    },
  });

  return { qtyBase: qtyBase.toString() };
}

/**
 * Manual stock change (use sheets, waste, count correction).
 * Positive qtyBase adds; negative removes. Cost is left unchanged.
 */
export async function adjustIngredientQty(
  tx: Tx,
  input: {
    ingredient: Ingredient;
    /** Signed change in base units (e.g. "-3" for three sheets used). */
    qtyBaseDelta: string;
    reason: string;
    actorUserId?: string;
  },
) {
  const delta = new Decimal(input.qtyBaseDelta);
  if (delta.isZero()) throw new Error("Enter a quantity.");

  const onHand = new Decimal(input.ingredient.qtyOnHandBase);
  const newOnHand = onHand.add(delta);
  if (newOnHand.lt(0)) {
    throw new Error(
      `Not enough ${input.ingredient.name} on hand (${onHand.toString()} ${input.ingredient.baseUnit}).`,
    );
  }

  await tx.ingredient.update({
    where: { id: input.ingredient.id },
    data: { qtyOnHandBase: newOnHand.toString() },
  });

  await tx.stockMovement.create({
    data: {
      type: "adjustment",
      ingredientId: input.ingredient.id,
      qtyBase: delta.toString(),
      unitCostCentavos: null,
      reason: input.reason || (delta.lt(0) ? "Used / deducted" : "Stock adjustment"),
      actorUserId: input.actorUserId,
    },
  });

  return { qtyOnHandBase: newOnHand.toString() };
}

/**
 * Deducts every recipe line for `batches` runs of the recipe, once.
 * Called only when a production batch is recorded — never on order creation.
 */
export async function consumeForProduction(
  tx: Tx,
  input: {
    productId: string;
    lines: Array<{
      ingredient: Ingredient;
      qty: string;
      unit: string;
      kind: string;
    }>;
    batches: string;
    yieldPieces: number;
    wastePieces: number;
    actorUserId?: string;
    notes?: string;
  },
) {
  const batchMultiplier = new Decimal(input.batches);
  if (batchMultiplier.lte(0)) throw new Error("Batches must be greater than zero");

  const snapshotLines: Array<{
    ingredientId: string;
    name: string;
    qtyBase: string;
    unitCostCentavos: string;
  }> = [];
  let ingredientCost = 0;

  for (const line of input.lines) {
    if (line.kind === "packaging") {
      // Packaging is still consumed; it just sits in a separate report bucket.
    }
    const perBatch = convertToBase(
      line.qty,
      line.unit,
      line.ingredient.baseUnit as BaseUnit,
      { [line.ingredient.purchaseUnit.toLowerCase()]: line.ingredient.purchaseToBase },
    );
    const total = perBatch.mul(batchMultiplier);
    const onHand = new Decimal(line.ingredient.qtyOnHandBase);
    const next = onHand.sub(total);
    if (next.lt(0)) {
      throw new Error(
        `Not enough ${line.ingredient.name}: need ${total.toString()} ${line.ingredient.baseUnit}, have ${onHand.toString()}.`,
      );
    }

    await tx.ingredient.update({
      where: { id: line.ingredient.id },
      data: { qtyOnHandBase: next.toString() },
    });

    const unitCost = line.ingredient.costPerBaseCentavos;
    const lineCost = Math.round(Number(total.mul(unitCost).toFixed(4)));
    ingredientCost += lineCost;

    await tx.stockMovement.create({
      data: {
        type: "production_consumption",
        ingredientId: line.ingredient.id,
        productId: input.productId,
        qtyBase: total.neg().toString(),
        unitCostCentavos: unitCost,
        reason: `Production of ${input.productId}`,
        actorUserId: input.actorUserId,
      },
    });

    snapshotLines.push({
      ingredientId: line.ingredient.id,
      name: line.ingredient.name,
      qtyBase: total.toString(),
      unitCostCentavos: unitCost,
    });
  }

  const producedPieces = Math.round(
    Number(batchMultiplier.mul(input.yieldPieces).toFixed(0)),
  );
  const netPieces = Math.max(0, producedPieces - input.wastePieces);

  await tx.product.update({
    where: { id: input.productId },
    data: { counterStock: { increment: netPieces } },
  });

  await tx.stockMovement.create({
    data: {
      type: "finished_goods_produced",
      productId: input.productId,
      qtyBase: String(netPieces),
      reason: "Production finished goods",
      actorUserId: input.actorUserId,
    },
  });

  if (input.wastePieces > 0) {
    await tx.stockMovement.create({
      data: {
        type: "waste",
        productId: input.productId,
        qtyBase: String(-input.wastePieces),
        reason: input.notes || "Production waste",
        actorUserId: input.actorUserId,
      },
    });
  }

  const batch = await tx.productionBatch.create({
    data: {
      productId: input.productId,
      batches: input.batches,
      yieldPieces: producedPieces,
      wastePieces: input.wastePieces,
      ingredientCostCentavos: ingredientCost,
      recipeSnapshot: JSON.stringify({ yieldPieces: input.yieldPieces, lines: snapshotLines }),
      notes: input.notes ?? "",
      actorUserId: input.actorUserId,
    },
  });

  return { batch, ingredientCost, netPieces };
}

/** Deduct finished goods for a counter (walk-in) sale. */
export async function sellFinishedGoods(
  tx: Tx,
  productId: string,
  qtyPieces: number,
  actorUserId?: string,
  orderId?: string,
) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (product.counterStock < qtyPieces) {
    throw new Error(`Only ${product.counterStock} of ${product.name} on the counter.`);
  }
  await tx.product.update({
    where: { id: productId },
    data: { counterStock: { decrement: qtyPieces } },
  });
  await tx.stockMovement.create({
    data: {
      type: "sale",
      productId,
      qtyBase: String(-qtyPieces),
      reason: orderId ? `Sale ${orderId}` : "Counter sale",
      refId: orderId,
      actorUserId,
    },
  });
}

export interface RestockNeed {
  ingredientId: string;
  name: string;
  baseUnit: string;
  qtyNeededBase: string;
  qtyOnHandBase: string;
  shortfallBase: string;
  purchaseUnit: string;
  purchaseToBase: string;
  /** How many purchase units to buy, rounded up. */
  buyPurchaseUnits: string;
  belowThreshold: boolean;
}

/**
 * Restock list: expand confirmed pre-orders through recipes into base units,
 * subtract on-hand, and express the shortfall in the units the owner buys in.
 */
export async function buildRestockList(menuId?: string): Promise<RestockNeed[]> {
  const ingredients = await db.ingredient.findMany({ orderBy: { name: "asc" } });
  const needed = new Map<string, Decimal>();

  const menu = menuId
    ? await db.weeklyMenu.findUnique({
        where: { id: menuId },
        include: {
          items: { include: { product: { include: { recipe: { include: { lines: true } } } } } },
          orders: {
            where: { paymentStatus: "paid", fulfillmentStatus: { not: "cancelled" } },
            include: { items: true },
          },
        },
      })
    : await db.weeklyMenu.findFirst({
        where: { status: "published" },
        orderBy: { pickupDate: "desc" },
        include: {
          items: { include: { product: { include: { recipe: { include: { lines: true } } } } } },
          orders: {
            where: { paymentStatus: "paid", fulfillmentStatus: { not: "cancelled" } },
            include: { items: true },
          },
        },
      });

  if (menu) {
    // Demand from paid orders, not from the weekly cap — bake what was sold.
    const soldByProduct = new Map<string, number>();
    for (const order of menu.orders) {
      for (const item of order.items) {
        soldByProduct.set(
          item.productId,
          (soldByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }
    for (const [productId, qty] of soldByProduct) {
      const item = menu.items.find((i) => i.productId === productId);
      const product = item?.product;
      if (!product?.recipe) continue;
      const pieces = qty * product.piecesPerUnit;
      const batches = new Decimal(pieces).div(product.recipe.yieldPieces);
      for (const line of product.recipe.lines) {
        const ing = ingredients.find((i) => i.id === line.ingredientId);
        if (!ing) continue;
        const perBatch = convertToBase(line.qty, line.unit, ing.baseUnit as BaseUnit, {
          [ing.purchaseUnit.toLowerCase()]: ing.purchaseToBase,
        });
        const total = perBatch.mul(batches);
        needed.set(ing.id, (needed.get(ing.id) ?? new Decimal(0)).add(total));
      }
    }
  }

  const result: RestockNeed[] = [];
  for (const ing of ingredients) {
    const need = needed.get(ing.id) ?? new Decimal(0);
    const onHand = new Decimal(ing.qtyOnHandBase);
    const threshold = new Decimal(ing.reorderThresholdBase);
    // Shortfall for production + anything needed to climb back above threshold.
    const target = Decimal.max(need, threshold);
    const shortfall = Decimal.max(0, target.sub(onHand));
    const belowThreshold = onHand.lt(threshold);
    if (shortfall.lte(0) && !belowThreshold) continue;

    const buy = shortfall.gt(0)
      ? baseToPurchase(shortfall, ing.purchaseToBase).toDecimalPlaces(2, Decimal.ROUND_UP)
      : new Decimal(0);

    result.push({
      ingredientId: ing.id,
      name: ing.name,
      baseUnit: ing.baseUnit,
      qtyNeededBase: need.toString(),
      qtyOnHandBase: onHand.toString(),
      shortfallBase: shortfall.toString(),
      purchaseUnit: ing.purchaseUnit,
      purchaseToBase: ing.purchaseToBase,
      buyPurchaseUnits: buy.toString(),
      belowThreshold,
    });
  }

  return result;
}
