import { cache } from "react";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/time";
import { readTrackedOrders } from "@/lib/tracked-orders";

const ACTIVE_FULFILLMENT = ["confirmed", "preparing", "ready", "coordinating"] as const;

export type ActiveOrderNotice = {
  code: string;
  token: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  pickupDateLabel: string;
  itemCount: number;
  fulfillment: string;
  headline: string;
  detail: string;
  urgency: "high" | "medium" | "low";
};

function urgencyOf(order: {
  fulfillmentStatus: string;
  paymentStatus: string;
}): ActiveOrderNotice["urgency"] {
  if (order.fulfillmentStatus === "ready") return "high";
  if (order.paymentStatus !== "paid") return "high";
  if (order.fulfillmentStatus === "preparing" || order.fulfillmentStatus === "coordinating") {
    return "medium";
  }
  return "low";
}

function copyFor(order: {
  code: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  fulfillment: string;
  pickupDateLabel: string;
  itemCount: number;
}): Pick<ActiveOrderNotice, "headline" | "detail"> {
  if (order.paymentStatus !== "paid") {
    if (order.paymentStatus === "submitted") {
      return {
        headline: "Payment under review",
        detail: `${order.code} · we are checking your payment proof`,
      };
    }
    return {
      headline: "Finish paying to confirm",
      detail: `${order.code} · ${order.itemCount} item${order.itemCount === 1 ? "" : "s"} waiting`,
    };
  }
  switch (order.fulfillmentStatus) {
    case "ready":
      return {
        headline: order.fulfillment === "delivery" ? "Out for handoff" : "Ready for collection",
        detail: `${order.code} · pick up ${order.pickupDateLabel}`,
      };
    case "preparing":
      return {
        headline: "We are baking your order",
        detail: `${order.code} · collect ${order.pickupDateLabel}`,
      };
    case "coordinating":
      return {
        headline: "Delivery being arranged",
        detail: `${order.code} · ${order.pickupDateLabel}`,
      };
    default:
      return {
        headline: "Order confirmed",
        detail: `${order.code} · collect ${order.pickupDateLabel}`,
      };
  }
}

function rank(a: ActiveOrderNotice, b: ActiveOrderNotice): number {
  const urgencyRank = { high: 0, medium: 1, low: 2 };
  return urgencyRank[a.urgency] - urgencyRank[b.urgency] || a.code.localeCompare(b.code);
}

/**
 * Active orders for the current visitor: signed-in by userId, plus any
 * guest orders remembered in the wk_orders cookie after checkout / lookup.
 * Request-deduped so layout + pages share one query.
 */
export const getActiveOrdersForVisitor = cache(async (
  userId?: string | null,
): Promise<ActiveOrderNotice[]> => {
  const tracked = await readTrackedOrders();
  if (!userId && tracked.length === 0) return [];

  const orFilters: Array<Record<string, unknown>> = [];
  if (userId) orFilters.push({ userId });
  for (const t of tracked) {
    orFilters.push({ code: t.code, accessToken: t.token });
  }

  const rows = await db.order.findMany({
    where: {
      fulfillmentStatus: { in: [...ACTIVE_FULFILLMENT] },
      OR: orFilters,
    },
    select: {
      code: true,
      accessToken: true,
      fulfillmentStatus: true,
      paymentStatus: true,
      fulfillment: true,
      pickupDate: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const notices: ActiveOrderNotice[] = rows.map((order) => {
    const pickupDateLabel = formatDay(order.pickupDate);
    const itemCount = order._count.items;
    const base = {
      code: order.code,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      pickupDateLabel,
      itemCount,
    };
    const copy = copyFor(base);
    return {
      code: order.code,
      token: order.accessToken,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      pickupDateLabel,
      itemCount,
      fulfillment: order.fulfillment,
      headline: copy.headline,
      detail: copy.detail,
      urgency: urgencyOf(order),
    };
  });

  const seen = new Set<string>();
  const unique = notices.filter((n) => {
    if (seen.has(n.code)) return false;
    seen.add(n.code);
    return true;
  });

  return unique.sort(rank);
});
