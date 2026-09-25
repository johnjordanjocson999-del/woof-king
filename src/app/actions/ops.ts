"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { parsePesoInput } from "@/lib/money";
import { receivePurchaseItem, consumeForProduction, sellFinishedGoods, adjustIngredientQty } from "@/domain/inventory";
import { orderCode, accessToken } from "@/lib/ids";
import { manilaMonthKey } from "@/lib/time";

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

export async function upsertIngredient(formData: FormData) : Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required.");

  const data = {
    name,
    baseUnit: String(formData.get("baseUnit") || "g"),
    purchaseUnit: String(formData.get("purchaseUnit") || "kg"),
    purchaseToBase: String(formData.get("purchaseToBase") || "1000"),
    reorderThresholdBase: String(formData.get("reorderThresholdBase") || "0"),
    supplier: String(formData.get("supplier") || ""),
  };

  if (id) {
    await db.ingredient.update({ where: { id }, data });
  } else {
    await db.ingredient.create({
      data: {
        ...data,
        qtyOnHandBase: "0",
        costPerBaseCentavos: "0",
      },
    });
  }
  revalidateAdmin();
  return;
}

/** One-tap restock: buy purchase-units of a single ingredient and update stock. */
export async function quickRestockIngredient(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const ingredientId = String(formData.get("ingredientId") || "");
  const qty = String(formData.get("qty") || "").trim();
  const costRaw = String(formData.get("cost") || "0").trim();
  const supplier = String(formData.get("supplier") || "").trim();
  if (!ingredientId) throw new Error("Pick an ingredient.");
  if (!qty || Number(qty) <= 0) throw new Error("Enter how many you bought.");

  const lineTotal = parsePesoInput(costRaw || "0");
  const ingredient = await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
  const unit = ingredient.purchaseUnit || ingredient.baseUnit;

  await db.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        supplier: supplier || ingredient.supplier || "Quick restock",
        notes: `Restock ${ingredient.name}`,
        totalCentavos: lineTotal,
      },
    });
    const { qtyBase } = await receivePurchaseItem(tx, {
      ingredient,
      qty,
      unit,
      lineTotalCentavos: lineTotal,
      purchaseId: purchase.id,
      actorUserId: staff.id,
    });
    await tx.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        ingredientId,
        qty,
        unit,
        qtyBase,
        lineTotalCentavos: lineTotal,
      },
    });
  });

  revalidateAdmin();
}

/** Manual use / deduct (or add-back) without a purchase or bake. */
export async function adjustIngredientStock(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const ingredientId = String(formData.get("ingredientId") || "");
  const qtyRaw = String(formData.get("qty") || "").trim();
  const direction = String(formData.get("direction") || "deduct"); // deduct | add
  const reason = String(formData.get("reason") || "").trim().slice(0, 200);
  if (!ingredientId) throw new Error("Pick an ingredient.");
  const qty = Number(qtyRaw);
  if (!qtyRaw || !Number.isFinite(qty) || qty <= 0) {
    throw new Error("Enter how many to use or add.");
  }

  const ingredient = await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
  const signed = direction === "add" ? String(qty) : String(-qty);

  await db.$transaction(async (tx) => {
    await adjustIngredientQty(tx, {
      ingredient,
      qtyBaseDelta: signed,
      reason:
        reason ||
        (direction === "add"
          ? `Manual add ${qty} ${ingredient.baseUnit}`
          : `Used ${qty} ${ingredient.baseUnit}`),
      actorUserId: staff.id,
    });
  });

  revalidateAdmin();
}

export async function logPurchase(formData: FormData) : Promise<void> {
  const staff = await requireStaff();
  const supplier = String(formData.get("supplier") || "");
  const notes = String(formData.get("notes") || "");
  const ingredientIds = formData.getAll("ingredientId").map(String);
  if (ingredientIds.length === 0) throw new Error("Add at least one line.");

  try {
    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: { supplier, notes, totalCentavos: 0 },
      });
      let total = 0;
      for (const ingredientId of ingredientIds) {
        const qty = String(formData.get(`qty_${ingredientId}`) || "");
        const unit = String(formData.get(`unit_${ingredientId}`) || "");
        const lineTotal = parsePesoInput(String(formData.get(`cost_${ingredientId}`) || "0"));
        if (!qty || !unit) continue;
        const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
        const { qtyBase } = await receivePurchaseItem(tx, {
          ingredient,
          qty,
          unit,
          lineTotalCentavos: lineTotal,
          purchaseId: purchase.id,
          actorUserId: staff.id,
        });
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            ingredientId,
            qty,
            unit,
            qtyBase,
            lineTotalCentavos: lineTotal,
          },
        });
        total += lineTotal;
      }
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { totalCentavos: total },
      });
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Purchase failed");
  }
  revalidateAdmin();
  return;
}

export async function saveRecipe(formData: FormData) : Promise<void> {
  await requireStaff();
  const productId = String(formData.get("productId") || "");
  const yieldPieces = Math.max(1, Number(formData.get("yieldPieces") || 1));
  const ovenMinutes = Math.max(0, Number(formData.get("ovenMinutes") || 0));
  const laborCentavos = parsePesoInput(String(formData.get("labor") || "0"));
  const instructions = String(formData.get("instructions") || "");

  const ingredientIds = formData.getAll("lineIngredientId").map(String);
  const qtys = formData.getAll("lineQty").map(String);
  const units = formData.getAll("lineUnit").map(String);
  const kinds = formData.getAll("lineKind").map(String);

  await db.$transaction(async (tx) => {
    const recipe = await tx.recipe.upsert({
      where: { productId },
      create: {
        productId,
        yieldPieces,
        ovenMinutes,
        laborCentavos,
        instructions,
      },
      update: { yieldPieces, ovenMinutes, laborCentavos, instructions },
    });
    await tx.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
    for (let i = 0; i < ingredientIds.length; i += 1) {
      if (!ingredientIds[i] || !qtys[i]) continue;
      await tx.recipeLine.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ingredientIds[i],
          qty: qtys[i],
          unit: units[i] || "g",
          kind: kinds[i] || "ingredient",
          position: i,
        },
      });
    }
  });

  revalidateAdmin();
  return;
}

export async function recordProduction(formData: FormData) : Promise<void> {
  const staff = await requireStaff();
  const productId = String(formData.get("productId") || "");
  const batches = String(formData.get("batches") || "1");
  const wastePieces = Math.max(0, Number(formData.get("wastePieces") || 0));
  const notes = String(formData.get("notes") || "");

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { lines: { include: { ingredient: true } } } } },
  });
  if (!product?.recipe) throw new Error("Product needs a recipe first.");

  try {
    await db.$transaction(async (tx) => {
      // Re-read ingredients inside the transaction for fresh on-hand.
      const lines = [];
      for (const line of product.recipe!.lines) {
        const ingredient = await tx.ingredient.findUniqueOrThrow({
          where: { id: line.ingredientId },
        });
        lines.push({
          ingredient,
          qty: line.qty,
          unit: line.unit,
          kind: line.kind,
        });
      }
      await consumeForProduction(tx, {
        productId,
        lines,
        batches,
        yieldPieces: product.recipe!.yieldPieces,
        wastePieces,
        actorUserId: staff.id,
        notes,
      });
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Production failed");
  }
  revalidateAdmin();
  return;
}

export async function saveOverhead(formData: FormData) : Promise<void> {
  await requireStaff();
  const month = String(formData.get("month") || manilaMonthKey(new Date()));
  await db.overhead.upsert({
    where: { month },
    create: {
      month,
      electricityCentavos: parsePesoInput(String(formData.get("electricity") || "0")),
      gasCentavos: parsePesoInput(String(formData.get("gas") || "0")),
      waterCentavos: parsePesoInput(String(formData.get("water") || "0")),
      rentCentavos: parsePesoInput(String(formData.get("rent") || "0")),
      laborCentavos: parsePesoInput(String(formData.get("labor") || "0")),
      otherCentavos: parsePesoInput(String(formData.get("other") || "0")),
      allocationBasis: String(formData.get("allocationBasis") || "units"),
      expectedUnits: Math.max(0, Number(formData.get("expectedUnits") || 0)),
      expectedHours: Math.max(0, Number(formData.get("expectedHours") || 0)),
      notes: String(formData.get("notes") || ""),
    },
    update: {
      electricityCentavos: parsePesoInput(String(formData.get("electricity") || "0")),
      gasCentavos: parsePesoInput(String(formData.get("gas") || "0")),
      waterCentavos: parsePesoInput(String(formData.get("water") || "0")),
      rentCentavos: parsePesoInput(String(formData.get("rent") || "0")),
      laborCentavos: parsePesoInput(String(formData.get("labor") || "0")),
      otherCentavos: parsePesoInput(String(formData.get("other") || "0")),
      allocationBasis: String(formData.get("allocationBasis") || "units"),
      expectedUnits: Math.max(0, Number(formData.get("expectedUnits") || 0)),
      expectedHours: Math.max(0, Number(formData.get("expectedHours") || 0)),
      notes: String(formData.get("notes") || ""),
    },
  });
  revalidateAdmin();
  return;
}

export async function posSale(formData: FormData) : Promise<void> {
  const staff = await requireStaff();
  const productId = String(formData.get("productId") || "");
  const qty = Math.max(1, Number(formData.get("qty") || 1));
  const method = String(formData.get("method") || "cash");
  const contactName = String(formData.get("contactName") || "Walk-in");
  const contactPhone = String(formData.get("contactPhone") || "n/a");

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found.");

  try {
    await db.$transaction(async (tx) => {
      await sellFinishedGoods(tx, productId, qty, staff.id);
      const total = product.priceCentavos * qty;
      const order = await tx.order.create({
        data: {
          code: orderCode(),
          accessToken: accessToken(),
          source: "counter",
          kind: "counter",
          fulfillment: "walkin",
          fulfillmentStatus: "completed",
          paymentStatus: "paid",
          contactName,
          contactPhone,
          pickupDate: new Date(),
          subtotalCentavos: total,
          totalCentavos: total,
          paidAt: new Date(),
          items: {
            create: {
              product: { connect: { id: productId } },
              nameSnapshot: product.name,
              quantity: qty,
              unitPriceCentavos: product.priceCentavos,
              allergensSnapshot: product.allergens,
            },
          },
          payments: {
            create: {
              provider: method === "cash" ? "cash" : "manual",
              method,
              status: "paid",
              amountCentavos: total,
              paidAt: new Date(),
              confirmedByUserId: staff.id,
            },
          },
        },
      });
      void order;
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Sale failed");
  }
  revalidateAdmin();
}
