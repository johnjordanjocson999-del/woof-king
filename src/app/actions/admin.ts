"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { saveUpload } from "@/lib/media";
import { slugify } from "@/lib/ids";
import { parsePesoInput } from "@/lib/money";
import { bakeCycleFor } from "@/lib/time";
import { getSettings, scheduleOf } from "@/lib/settings";
import { MAX_MENU_ITEMS, MIN_MENU_ITEMS } from "@/domain/menu";

function revalidateAdmin() {
  // Immediate cache bust from Server Actions (Next 16: use updateTag, not revalidateTag alone).
  updateTag("settings");
  updateTag("menu");
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/** Fulfillment moves only — don't rebuild the whole storefront. */
function revalidateFulfillment() {
  updateTag("menu");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function updateOrderStatusForm(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") || "");
  const fulfillmentStatus = String(formData.get("status") || "");
  if (!orderId || !fulfillmentStatus) return;
  await updateOrderStatus(orderId, fulfillmentStatus);
}

export async function upsertProduct(formData: FormData) : Promise<{ ok: boolean; message: string; id?: string }> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) return { ok: false, message: "Name is required." };

  let priceCentavos: number;
  try {
    priceCentavos = parsePesoInput(String(formData.get("price") || "0"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bad price" };
  }

  const allergenList = formData.getAll("allergens").map(String).filter(Boolean);

  const data = {
    name,
    slug: slugify(name),
    description: String(formData.get("description") || ""),
    category: String(formData.get("category") || "bread"),
    allergens: allergenList.join(","),
    priceCentavos,
    sellingUnit: String(formData.get("sellingUnit") || "piece"),
    piecesPerUnit: Math.max(1, Number(formData.get("piecesPerUnit") || 1)),
    storageNotes: String(formData.get("storageNotes") || ""),
    shelfLifeNotes: String(formData.get("shelfLifeNotes") || ""),
    focalX: Math.min(1, Math.max(0, Number(formData.get("focalX") || 0.5))),
    focalY: Math.min(1, Math.max(0, Number(formData.get("focalY") || 0.5))),
    imageZoom: Math.min(2.5, Math.max(1, Number(formData.get("imageZoom") || 1))),
    archived: formData.get("archived") === "on",
    featured: formData.get("featured") === "on",
  };

  const file = formData.get("image");
  let imagePath: string | undefined;
  if (file instanceof File && file.size > 0) {
    try {
      const saved = await saveUpload(file, "products");
      imagePath = saved.path;
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Upload failed" };
    }
  }

  if (id) {
    const updated = await db.product.update({
      where: { id },
      data: { ...data, ...(imagePath ? { imagePath } : {}) },
    });
    revalidateAdmin();
    return { ok: true, message: "Saved.", id: updated.id };
  }

  // Unique slug: append short suffix if collision.
  let slug = data.slug;
  const clash = await db.product.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const created = await db.product.create({
    data: { ...data, slug, imagePath },
  });
  revalidateAdmin();
  return { ok: true, message: "Product created.", id: created.id };
}

export async function createWeeklyMenu(formData: FormData) : Promise<void> {
  await requireStaff();
  const settings = await getSettings();
  const cycle = bakeCycleFor(new Date(), scheduleOf(settings));
  const title = String(formData.get("title") || "This week's table").trim();

  await db.weeklyMenu.create({
    data: {
      title,
      status: "draft",
      orderOpensAt: cycle.orderOpensAt,
      cutoffAt: cycle.cutoffAt,
      prepDates: cycle.prepDates.join(","),
      pickupDate: cycle.pickupDate,
    },
  });
  revalidateAdmin();
  return;
}

export async function setMenuItems(formData: FormData) : Promise<void> {
  await requireStaff();
  const menuId = String(formData.get("menuId") || "");
  const productIds = formData.getAll("productId").map(String).filter(Boolean);

  if (productIds.length < MIN_MENU_ITEMS || productIds.length > MAX_MENU_ITEMS) {
    throw new Error(`A rotation must have ${MIN_MENU_ITEMS}–${MAX_MENU_ITEMS} products.`);
  }

  const menu = await db.weeklyMenu.findUnique({ where: { id: menuId } });
  if (!menu) throw new Error("Menu not found.");
  if (menu.status === "published") {
    throw new Error("Unpublish before editing items, or create a new week.");
  }

  await db.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { menuId } });
    for (const [position, productId] of productIds.entries()) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const limitRaw = formData.get(`limit_${productId}`);
      const priceRaw = formData.get(`price_${productId}`);
      let priceCentavos = product.priceCentavos;
      if (typeof priceRaw === "string" && priceRaw.trim()) {
        priceCentavos = parsePesoInput(priceRaw);
      }
      const quantityLimit = Math.max(0, Number(limitRaw || 0));
      await tx.menuItem.create({
        data: {
          menuId,
          productId,
          position,
          priceCentavos,
          quantityLimit,
        },
      });
    }
  });

  revalidateAdmin();
  return;
}

export async function publishMenu(menuId: string) : Promise<void> {
  await requireStaff();
  const menu = await db.weeklyMenu.findUnique({
    where: { id: menuId },
    include: { items: true },
  });
  if (!menu) throw new Error("Menu not found.");
  if (menu.items.length < MIN_MENU_ITEMS || menu.items.length > MAX_MENU_ITEMS) {
    throw new Error(
      `Publish needs ${MIN_MENU_ITEMS}–${MAX_MENU_ITEMS} items (currently ${menu.items.length}).`,
    );
  }

  await db.$transaction(async (tx) => {
    // Close any other published menu so only one is live.
    await tx.weeklyMenu.updateMany({
      where: { status: "published", id: { not: menuId } },
      data: { status: "closed" },
    });
    await tx.weeklyMenu.update({
      where: { id: menuId },
      data: { status: "published", publishedAt: new Date() },
    });
  });

  // Handoff days/times come from /admin/availability — owner paints the calendar.

  revalidateAdmin();
  return;
}

export async function updateOrderStatus(
  orderId: string,
  fulfillmentStatus: string,
) : Promise<void> {
  await requireStaff();
  const allowed = ["confirmed", "preparing", "ready", "coordinating", "completed", "cancelled"];
  if (!allowed.includes(fulfillmentStatus)) throw new Error("Bad status.");
  await db.order.update({ where: { id: orderId }, data: { fulfillmentStatus } });
  revalidateFulfillment();
  return;
}

export async function updateCustomerNotes(customerId: string, formData: FormData) {
  await requireStaff();
  await db.customer.update({
    where: { id: customerId },
    data: { notes: String(formData.get("notes") || "") },
  });
  revalidateAdmin();
}

export async function saveSettings(formData: FormData) : Promise<void> {
  await requireStaff();
  const hero = formData.get("hero");
  let heroPath: string | undefined;
  if (hero instanceof File && hero.size > 0) {
    heroPath = (await saveUpload(hero, "branding")).path;
  }

  await db.settings.update({
    where: { id: "singleton" },
    data: {
      bakeryName: String(formData.get("bakeryName") || "Woof King"),
      tagline: String(formData.get("tagline") || ""),
      heroHeading: String(formData.get("heroHeading") || ""),
      heroBody: String(formData.get("heroBody") || ""),
      story: String(formData.get("story") || ""),
      announcement: String(formData.get("announcement") || ""),
      policies: String(formData.get("policies") || ""),
      cancellationPol: String(formData.get("cancellationPol") || ""),
      contactEmail: String(formData.get("contactEmail") || ""),
      contactPhone: String(formData.get("contactPhone") || ""),
      contactTelephone: String(formData.get("contactTelephone") || ""),
      pickupAddress: String(formData.get("pickupAddress") || ""),
      gcashName: String(formData.get("gcashName") || ""),
      gcashNumber: String(formData.get("gcashNumber") || ""),
      vybeQrPath: String(formData.get("vybeQrPath") || "/uploads/payments/vybe-qr.png"),
      maribankQrPath: String(
        formData.get("maribankQrPath") || "/uploads/payments/maribank-qr.png",
      ),
      deliveryBaseFeeCentavos: Number(formData.get("deliveryBaseFeeCentavos") || 5000),
      deliveryPerKmCentavos: 0,
      paymentProvider: String(formData.get("paymentProvider") || "manual"),
      paymongoSecretKey: String(formData.get("paymongoSecretKey") || "") || null,
      paymongoWebhookKey: String(formData.get("paymongoWebhookKey") || "") || null,
      paymongoMethods: String(formData.get("paymongoMethods") || "gcash,card"),
      qrphEnabled: formData.get("qrphEnabled") === "on",
      vatRegistered: formData.get("vatRegistered") === "on",
      vatMode: String(formData.get("vatMode") || "none"),
      deliveryNote: String(formData.get("deliveryNote") || ""),
      cutoffHour: Number(formData.get("cutoffHour") || 23),
      cutoffMinute: Number(formData.get("cutoffMinute") || 59),
      loyaltyEnabled: formData.get("loyaltyEnabled") === "on",
      loyaltyVolumeThreshold: Math.max(1, Number(formData.get("loyaltyVolumeThreshold") || 10)),
      loyaltyVolumeDiscountBps: Math.round(
        Math.max(0, Number(formData.get("loyaltyVolumeDiscountPercent") || 20)) * 100,
      ),
      loyaltyStreakWeeks: Math.max(1, Number(formData.get("loyaltyStreakWeeks") || 5)),
      loyaltyStreakDiscountBps: Math.round(
        Math.max(0, Number(formData.get("loyaltyStreakDiscountPercent") || 10)) * 100,
      ),
      loyaltyCashbackPer100Centavos: Math.round(
        Math.max(0, Number(formData.get("loyaltyCashbackPer100Pesos") || 2)) * 100,
      ),
      ...(heroPath ? { heroPath } : {}),
    },
  });
  revalidateAdmin();
  return;
}
