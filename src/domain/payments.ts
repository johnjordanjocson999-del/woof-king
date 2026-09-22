import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { Order, Payment, Settings } from "@prisma/client";
import { getPaymentOptionBySlug } from "@/domain/payment-options";
import { nextLoyaltyState } from "@/domain/loyalty";

/**
 * Payment adapters.
 *
 * Manual channels (VYBE, GCash, banks, cash) come from PaymentOption rows.
 * PayMongo / mock stay as hosted adapters when Settings.paymentProvider says so.
 */

export type PaymentMethod = string;

export interface CheckoutStart {
  payment: Payment;
  redirectUrl: string | null;
  instructions?: string;
}

export interface PaymentAdapter {
  id: "manual" | "paymongo" | "mock";
  startCheckout(input: {
    order: Order;
    settings: Settings;
    method: PaymentMethod;
    returnUrl: string;
  }): Promise<CheckoutStart>;
}

/**
 * Public site origin for payment return links.
 * When APP_URL is still localhost (dev), prefer the Host the customer used
 * (e.g. phone on LAN: http://192.168.0.100:3000) so redirects don't break.
 */
function appUrl(requestHost?: string | null): string {
  const env = process.env.APP_URL?.replace(/\/$/, "") || "";
  const host = (requestHost || "").replace(/\/$/, "").trim();
  const envIsLocal = !env || /localhost|127\.0\.0\.1/i.test(env);

  if (host && envIsLocal) {
    const bare = host.replace(/^https?:\/\//i, "");
    const proto = /^(localhost|127\.0\.0\.1)(:|$)/i.test(bare) ? "http" : "http";
    return `${proto}://${bare}`;
  }

  return env || "http://localhost:3000";
}

/* ---------------------------------------------------------------- manual */

const manualAdapter: PaymentAdapter = {
  id: "manual",
  async startCheckout({ order, settings, method }) {
    const option = await getPaymentOptionBySlug(method);

    if (!option || !option.active) {
      // Allow legacy slugs before options are seeded.
      if (!["vybe", "maribank", "gcash", "cash"].includes(method)) {
        throw new Error("That payment method is not available.");
      }
    }

    const type = option?.type ?? (method === "cash" ? "cash" : "qr");
    const name = option?.name ?? method;

    if (type === "cash") {
      if (order.fulfillment !== "pickup" && order.fulfillment !== "walkin") {
        throw new Error("Cash is only available for pickup orders.");
      }
      const payment = await db.payment.create({
        data: {
          orderId: order.id,
          provider: "cash",
          method: "cash",
          status: "pending",
          amountCentavos: order.totalCentavos,
          referenceNote: `Pay cash at pickup for order ${order.code}`,
        },
      });
      await db.order.update({
        where: { id: order.id },
        data: { paymentStatus: "pending" },
      });
      return {
        payment,
        redirectUrl: `/order/${order.code}?token=${order.accessToken}&pay=cash`,
        instructions: `Pay ₱${(order.totalCentavos / 100).toFixed(2)} in cash when you collect. Bring order code ${order.code}.`,
      };
    }

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "manual",
        method,
        status: "pending",
        amountCentavos: order.totalCentavos,
        referenceNote: `Awaiting ${name} payment for order ${order.code}`,
      },
    });
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "pending" },
    });
    return {
      payment,
      redirectUrl: `/order/${order.code}?token=${order.accessToken}&pay=manual&channel=${method}`,
      instructions: `Pay ₱${(order.totalCentavos / 100).toFixed(2)} via ${name}. Use order code ${order.code} as your reference.`,
    };
  },
};

/* ---------------------------------------------------------------- mock */

const mockAdapter: PaymentAdapter = {
  id: "mock",
  async startCheckout({ order, method }) {
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "mock",
        method,
        status: "pending",
        amountCentavos: order.totalCentavos,
        isMock: true,
        referenceNote: "DEMO — not a real transaction",
      },
    });
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "pending" },
    });
    return {
      payment,
      redirectUrl: `/pay/mock?paymentId=${payment.id}&token=${order.accessToken}`,
      instructions: "This is a labelled demo payment. It will not charge a real card or GCash.",
    };
  },
};

/* ------------------------------------------------------------- paymongo */

const paymongoAdapter: PaymentAdapter = {
  id: "paymongo",
  async startCheckout({ order, settings, method, returnUrl }) {
    const secret =
      settings.paymongoSecretKey || process.env.PAYMONGO_SECRET_KEY || "";
    if (!secret) {
      return mockAdapter.startCheckout({ order, settings, method, returnUrl });
    }

    const paymentMethods: string[] = [];
    if (method === "gcash") paymentMethods.push("gcash");
    else if (method === "card") paymentMethods.push("card");
    else if (method === "qrph") paymentMethods.push("qrph");
    else paymentMethods.push(...settings.paymongoMethods.split(",").map((m) => m.trim()));

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "paymongo",
        method,
        status: "pending",
        amountCentavos: order.totalCentavos,
      },
    });

    const body = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: `Woof King order ${order.code}`,
          line_items: [
            {
              currency: "PHP",
              amount: order.totalCentavos,
              name: `Order ${order.code}`,
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethods,
          success_url: `${returnUrl}?status=success&paymentId=${payment.id}`,
          cancel_url: `${returnUrl}?status=cancel&paymentId=${payment.id}`,
          metadata: {
            order_id: order.id,
            order_code: order.code,
            payment_id: payment.id,
          },
        },
      },
    };

    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "failed", referenceNote: text.slice(0, 500) },
      });
      throw new Error(`PayMongo checkout failed (${res.status}). Check your secret key.`);
    }

    const json = (await res.json()) as {
      data: { id: string; attributes: { checkout_url: string } };
    };

    await db.payment.update({
      where: { id: payment.id },
      data: {
        checkoutSessionId: json.data.id,
        checkoutUrl: json.data.attributes.checkout_url,
      },
    });
    await db.order.update({
      where: { id: order.id },
      data: { paymentStatus: "pending" },
    });

    return {
      payment: {
        ...payment,
        checkoutSessionId: json.data.id,
        checkoutUrl: json.data.attributes.checkout_url,
      },
      redirectUrl: json.data.attributes.checkout_url,
    };
  },
};

export function getPaymentAdapter(settings: Settings): PaymentAdapter {
  if (settings.paymentProvider === "paymongo") return paymongoAdapter;
  if (settings.paymentProvider === "mock") return mockAdapter;
  return manualAdapter;
}

export async function markPaymentPaid(input: {
  paymentId: string;
  providerPaymentId?: string;
  confirmedByUserId?: string;
}): Promise<{ order: Order; payment: Payment }> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
    if (payment.status === "paid") {
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      return { order, payment };
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        providerPaymentId: input.providerPaymentId ?? payment.providerPaymentId,
        confirmedByUserId: input.confirmedByUserId,
      },
    });

    const order = await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "paid", paidAt: new Date() },
    });

    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      if (item.menuItemId) {
        await tx.menuItem.update({
          where: { id: item.menuItemId },
          data: { soldCount: { increment: item.quantity } },
        });
      }
    }

    if (order.contactPhone) {
      let customer =
        (order.customerId
          ? await tx.customer.findUnique({ where: { id: order.customerId } })
          : null) ??
        (order.userId
          ? await tx.customer.findUnique({ where: { userId: order.userId } })
          : null) ??
        (await tx.customer.findFirst({ where: { phone: order.contactPhone } }));

      const productQty = items.reduce((s, i) => s + i.quantity, 0);
      const isMember = Boolean(order.userId || customer?.userId);

      if (customer) {
        const loyaltyPatch =
          isMember
            ? nextLoyaltyState({
                customer,
                pickupDate: order.pickupDate,
                productQty,
                cashbackAppliedCentavos: Math.min(
                  customer.cashbackBalanceCentavos,
                  order.cashbackAppliedCentavos,
                ),
                cashbackEarnedCentavos: order.cashbackEarnedCentavos,
              })
            : null;

        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpentCentavos: { increment: order.totalCentavos },
            lastOrderAt: new Date(),
            name: order.contactName || customer.name,
            email: order.contactEmail || customer.email,
            ...(order.userId && !customer.userId ? { userId: order.userId } : {}),
            ...(loyaltyPatch ?? {}),
          },
        });
        if (!order.customerId) {
          await tx.order.update({
            where: { id: order.id },
            data: { customerId: customer.id },
          });
        }
      } else {
        const loyaltySeed = isMember
          ? nextLoyaltyState({
              customer: {
                lifetimeProductQty: 0,
                weeklyOrderStreak: 0,
                lastStreakPickupWeekKey: null,
                cashbackBalanceCentavos: 0,
              },
              pickupDate: order.pickupDate,
              productQty,
              cashbackAppliedCentavos: 0,
              cashbackEarnedCentavos: order.cashbackEarnedCentavos,
            })
          : {
              lifetimeProductQty: 0,
              weeklyOrderStreak: 0,
              lastStreakPickupWeekKey: null as string | null,
              cashbackBalanceCentavos: 0,
            };

        const created = await tx.customer.create({
          data: {
            name: order.contactName,
            phone: order.contactPhone,
            email: order.contactEmail,
            userId: order.userId,
            totalOrders: 1,
            totalSpentCentavos: order.totalCentavos,
            lastOrderAt: new Date(),
            addressLine: order.deliveryAddress,
            deliveryInstructions: order.deliveryInstructions,
            ...loyaltySeed,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { customerId: created.id },
        });
      }
    }

    return { order, payment: updated };
  });
}

export function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((pair) => {
      const [k, v] = pair.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );
  const timestamp = parts.t;
  const sig = parts.te || parts.li;
  if (!timestamp || !sig) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** @deprecated Prefer resolveOnlinePaymentOptions — kept for older call sites. */
export async function availableMethods(settings: Settings): Promise<PaymentMethod[]> {
  const { resolveOnlinePaymentOptions } = await import("@/domain/payment-options");
  const opts = await resolveOnlinePaymentOptions(settings);
  return opts.map((o) => o.slug);
}

export { appUrl };
