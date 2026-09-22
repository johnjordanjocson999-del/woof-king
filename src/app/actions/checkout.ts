"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearCart, readCart } from "@/lib/cart";
import { rememberOrder } from "@/lib/tracked-orders";
import { getSettings, vatOf } from "@/lib/settings";
import { getActiveMenu, ordersOpen, remainingFor } from "@/domain/menu";
import { isBasketPayable, resolveBasket } from "@/domain/basket";
import { accessToken, orderCode } from "@/lib/ids";
import { applyVat } from "@/lib/money";
import { currentUser } from "@/lib/auth";
import { flatDeliveryFeeCentavos } from "@/domain/delivery-fee";
import { computeLoyaltyQuote } from "@/domain/loyalty";
import { resolveOnlinePaymentOptions } from "@/domain/payment-options";
import { getPaymentAdapter, appUrl } from "@/domain/payments";
import { rememberSavedAddress } from "@/lib/saved-addresses";

const checkoutSchema = z.object({
  contactName: z.string().trim().min(2, "Name is required").max(80),
  contactPhone: z
    .string()
    .trim()
    .min(10, "A phone number is required")
    .max(20)
    .regex(/^[0-9+\s()-]+$/, "Use digits and + ( ) - only"),
  contactEmail: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
  fulfillment: z.enum(["pickup", "delivery"]),
  pickupSlotId: z.string().optional(),
  deliveryWindowId: z.string().optional(),
  deliveryAddress: z.string().trim().max(300).optional(),
  deliveryInstructions: z.string().trim().max(400).optional(),
  paymentMethod: z.string().trim().min(1, "Pick a payment method"),
});

export type CheckoutValues = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  fulfillment: "pickup" | "delivery";
  pickupSlotId: string;
  deliveryWindowId: string;
  deliveryAddress: string;
  deliveryInstructions: string;
  paymentMethod: string;
};

export type CheckoutState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of what the customer typed — kept on error so the form is not wiped. */
  values?: CheckoutValues;
};

function readCheckoutValues(formData: FormData): CheckoutValues {
  const fulfillmentRaw = String(formData.get("fulfillment") || "pickup");
  return {
    contactName: String(formData.get("contactName") || ""),
    contactPhone: String(formData.get("contactPhone") || ""),
    contactEmail: String(formData.get("contactEmail") || ""),
    notes: String(formData.get("notes") || ""),
    fulfillment: fulfillmentRaw === "delivery" ? "delivery" : "pickup",
    pickupSlotId: String(formData.get("pickupSlotId") || ""),
    deliveryWindowId: String(formData.get("deliveryWindowId") || ""),
    deliveryAddress: String(formData.get("deliveryAddress") || ""),
    deliveryInstructions: String(formData.get("deliveryInstructions") || ""),
    paymentMethod: String(formData.get("paymentMethod") || ""),
  };
}

function failCheckout(
  formData: FormData,
  message: string,
  fieldErrors?: Record<string, string>,
): CheckoutState {
  return {
    ok: false,
    message,
    fieldErrors,
    values: readCheckoutValues(formData),
  };
}

/**
 * Creates the order and starts payment in one shot.
 *
 * Cutoff, capacity and remaining stock are re-checked here — never trusted from
 * the cookie or the form — because two customers can hit the last loaf at once.
 */
export async function placeOrder(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const now = new Date();
  const settings = await getSettings();
  const menu = await getActiveMenu(now);

  if (!ordersOpen(menu, now) || !menu) {
    return failCheckout(formData, "Orders for this week have closed.");
  }

  const parsed = checkoutSchema.safeParse({
    contactName: formData.get("contactName"),
    contactPhone: formData.get("contactPhone"),
    contactEmail: formData.get("contactEmail") || "",
    notes: formData.get("notes") || "",
    fulfillment: formData.get("fulfillment"),
    pickupSlotId: formData.get("pickupSlotId") || undefined,
    deliveryWindowId: formData.get("deliveryWindowId") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || "",
    deliveryInstructions: formData.get("deliveryInstructions") || "",
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return failCheckout(formData, "Check the highlighted fields.", fieldErrors);
  }

  const data = parsed.data;
  const methods = await resolveOnlinePaymentOptions(settings, data.fulfillment);
  const selected = methods.find((m) => m.slug === data.paymentMethod);
  if (!selected) {
    return failCheckout(formData, "That payment method is not available for this order.", {
      paymentMethod: "Pick another payment method",
    });
  }
  if (selected.type === "cash" && data.fulfillment !== "pickup") {
    return failCheckout(formData, "Cash is only available for pickup.", {
      paymentMethod: "Cash is pickup only",
    });
  }

  if (data.fulfillment === "pickup") {
    if (!data.pickupSlotId) {
      return failCheckout(formData, "Pick a Sunday collection slot.", {
        pickupSlotId: "Required",
      });
    }
  } else {
    if (!data.deliveryAddress || data.deliveryAddress.length < 8) {
      return failCheckout(formData, "Delivery needs a full address.", {
        deliveryAddress: "Required for delivery",
      });
    }
    const openWindows = await db.deliveryWindow.count({
      where: { active: true, menuId: menu.id },
    });
    if (openWindows > 0 && !data.deliveryWindowId) {
      return failCheckout(formData, "Pick an available delivery date and time.", {
        deliveryWindowId: "Required",
      });
    }
  }

  const cart = await readCart();
  const basket = resolveBasket(cart, menu, settings);
  if (!isBasketPayable(basket)) {
    return failCheckout(formData, "Your basket is empty or no longer available.");
  }

  const deliveryFeeCentavos =
    data.fulfillment === "delivery" ? flatDeliveryFeeCentavos(settings) : 0;
  const deliveryDistanceKm: number | null = null;

  // Re-check remaining against live sold counts inside a transaction.
  try {
    const user = await currentUser();
    const vat = vatOf(settings);
    const payableLines = basket.lines.filter((l) => l.qty > 0);
    const menuItemIds = payableLines.map((l) => l.menuItemId);

    // Loyalty / customer linking runs outside the interactive transaction so
    // Supabase latency (Vercel iad1 ↔ DB) does not burn the 5s default budget.
    let memberCustomer =
      user?.id ? await db.customer.findUnique({ where: { userId: user.id } }) : null;
    if (!memberCustomer && user?.id && data.contactPhone) {
      const byPhone = await db.customer.findFirst({
        where: { phone: data.contactPhone, userId: null },
      });
      if (byPhone) {
        memberCustomer = await db.customer.update({
          where: { id: byPhone.id },
          data: { userId: user.id },
        });
      }
    }

    const subtotal = payableLines.reduce((s, l) => s + l.lineTotalCentavos, 0);
    const cartProductQty = payableLines.reduce((s, l) => s + l.qty, 0);
    const loyalty = computeLoyaltyQuote({
      settings,
      customer: memberCustomer,
      cartProductQty,
      productSubtotalCentavos: subtotal,
      pickupDate: menu.pickupDate,
    });
    const afterDiscount = Math.max(0, subtotal - loyalty.discountCentavos);
    const applied = applyVat(afterDiscount, vat.mode, vat.rateBps);
    const orderTotal = applied.total + deliveryFeeCentavos;

    const order = await db.$transaction(
      async (tx) => {
        // One round-trip for stock instead of N findUnique calls.
        const liveItems = await tx.menuItem.findMany({
          where: { id: { in: menuItemIds } },
        });
        const liveById = new Map(liveItems.map((item) => [item.id, item]));
        for (const line of payableLines) {
          const live = liveById.get(line.menuItemId);
          if (!live) throw new Error(`${line.product.name} is no longer on the menu.`);
          const rem = remainingFor(live);
          if (rem !== null && rem < line.qty) {
            throw new Error(
              `Only ${rem} of ${line.product.name} left this week. Update your basket.`,
            );
          }
        }

        if (data.fulfillment === "pickup" && data.pickupSlotId) {
          const slot = await tx.pickupSlot.findUnique({ where: { id: data.pickupSlotId } });
          if (!slot || !slot.active) throw new Error("That collection slot is not available.");
          const booked = await tx.order.count({
            where: {
              pickupSlotId: slot.id,
              pickupDate: menu.pickupDate,
              paymentStatus: { in: ["pending", "submitted", "paid"] },
              fulfillmentStatus: { not: "cancelled" },
            },
          });
          if (booked >= slot.capacity) {
            throw new Error(`"${slot.label}" is full. Pick another slot.`);
          }
        }

        if (data.fulfillment === "delivery" && data.deliveryWindowId) {
          const window = await tx.deliveryWindow.findUnique({
            where: { id: data.deliveryWindowId },
          });
          if (!window || !window.active) {
            throw new Error("That delivery window is not available.");
          }
          if (window.menuId && window.menuId !== menu.id) {
            throw new Error("That delivery window belongs to another week.");
          }
          const booked = await tx.order.count({
            where: {
              deliveryWindowId: window.id,
              paymentStatus: { in: ["pending", "submitted", "paid"] },
              fulfillmentStatus: { not: "cancelled" },
            },
          });
          if (booked >= window.capacity) {
            throw new Error(`"${window.label}" is full. Pick another window.`);
          }
        }

        return tx.order.create({
          data: {
            code: orderCode(),
            accessToken: accessToken(),
            menu: { connect: { id: menu.id } },
            ...(user?.id ? { user: { connect: { id: user.id } } } : {}),
            ...(memberCustomer ? { customer: { connect: { id: memberCustomer.id } } } : {}),
            source: "web",
            kind: "preorder",
            fulfillment: data.fulfillment,
            fulfillmentStatus: data.fulfillment === "delivery" ? "coordinating" : "confirmed",
            paymentStatus: "unpaid",
            contactName: data.contactName,
            contactPhone: data.contactPhone,
            contactEmail: data.contactEmail || null,
            notes: data.notes || "",
            pickupDate: menu.pickupDate,
            ...(data.fulfillment === "pickup" && data.pickupSlotId
              ? { pickupSlot: { connect: { id: data.pickupSlotId } } }
              : {}),
            ...(data.fulfillment === "delivery" && data.deliveryWindowId
              ? { deliveryWindow: { connect: { id: data.deliveryWindowId } } }
              : {}),
            deliveryAddress: data.fulfillment === "delivery" ? data.deliveryAddress! : "",
            deliveryInstructions:
              data.fulfillment === "delivery" ? data.deliveryInstructions || "" : "",
            deliveryFeeCentavos,
            deliveryDistanceKm,
            subtotalCentavos: vat.mode === "inclusive" ? applied.base : afterDiscount,
            vatCentavos: applied.vat,
            discountCentavos: loyalty.discountCentavos,
            cashbackAppliedCentavos: loyalty.cashbackAppliedCentavos,
            cashbackEarnedCentavos: loyalty.cashbackEarnedCentavos,
            loyaltyNote: loyalty.labels.join(" · "),
            totalCentavos: orderTotal,
            vatModeSnapshot: vat.mode,
            vatRateBpsSnapshot: vat.rateBps,
            cancellationPolicySnapshot: settings.cancellationPol,
            items: {
              create: payableLines.map((line) => ({
                product: { connect: { id: line.product.id } },
                menuItem: { connect: { id: line.menuItemId } },
                nameSnapshot: line.product.name,
                quantity: line.qty,
                unitPriceCentavos: line.unitPriceCentavos,
                allergensSnapshot: line.product.allergens,
              })),
            },
          },
        });
      },
      // Supabase over the public internet often needs >5s for multi-query txs.
      { maxWait: 15_000, timeout: 25_000 },
    );

    const adapter = getPaymentAdapter(settings);
    const hdrs = await headers();
    const requestHost = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const started = await adapter.startCheckout({
      order,
      settings,
      method: data.paymentMethod,
      returnUrl: `${appUrl(requestHost)}/order/${order.code}?token=${order.accessToken}`,
    });

    await clearCart();
    await rememberOrder(order.code, order.accessToken);

    if (data.fulfillment === "delivery" && data.deliveryAddress) {
      const wantsSave = String(formData.get("saveAddress") ?? "1") !== "0";
      const wantsFavorite = String(formData.get("favoriteAddress") || "") === "1";
      if (wantsSave || wantsFavorite) {
        await rememberSavedAddress({
          address: data.deliveryAddress,
          instructions: data.deliveryInstructions || "",
          favorite: wantsFavorite,
          label: wantsFavorite ? "Favorite" : "",
        });
      }
      if (user?.id) {
        await db.customer.updateMany({
          where: { userId: user.id },
          data: {
            addressLine: data.deliveryAddress.slice(0, 300),
            deliveryInstructions: (data.deliveryInstructions || "").slice(0, 400),
          },
        });
      }
    }

    if (started.redirectUrl) {
      redirect(started.redirectUrl);
    }
    redirect(`/order/${order.code}?token=${order.accessToken}`);
  } catch (error) {
    // Next.js redirect throws a special error — rethrow it.
    if (error && typeof error === "object" && "digest" in error) {
      const digest = String((error as { digest?: string }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT")) throw error;
    }
    return failCheckout(formData, friendlyCheckoutError(error));
  }
}

function friendlyCheckoutError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (!raw) return "Could not place the order. Please try again.";
  // Never dump Prisma / SQL internals onto the storefront.
  if (
    /prisma|invocation|transaction|timed out|timeout|expired transaction|connector/i.test(raw)
  ) {
    return "The bakery is busy right now — please wait a moment and try placing your order again.";
  }
  return raw;
}
