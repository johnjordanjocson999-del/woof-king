import type { Customer, Settings } from "@prisma/client";
import { manilaParts } from "@/lib/time";
import type { Centavos } from "@/lib/money";

export type LoyaltyCustomerSnapshot = Pick<
  Customer,
  | "lifetimeProductQty"
  | "weeklyOrderStreak"
  | "lastStreakPickupWeekKey"
  | "cashbackBalanceCentavos"
>;

export type LoyaltyQuote = {
  volumeDiscountCentavos: Centavos;
  streakDiscountCentavos: Centavos;
  cashbackAppliedCentavos: Centavos;
  discountCentavos: Centavos;
  cashbackEarnedCentavos: Centavos;
  /** Human-readable lines for checkout / account. */
  labels: string[];
  volumeUnlocked: boolean;
  streakUnlocked: boolean;
  piecesTowardVolume: number;
  volumeThreshold: number;
  streakWeeks: number;
  currentStreak: number;
};

/** Manila ISO week key, e.g. "2026-W39". */
export function manilaWeekKey(date: Date): string {
  const p = manilaParts(date);
  // ISO week: Thursday of this week decides the year/week number.
  const utc = Date.UTC(p.year, p.month - 1, p.day);
  const day = new Date(utc);
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Previous ISO week key (handles year wrap). */
export function previousWeekKey(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  let year = Number(match[1]);
  let week = Number(match[2]) - 1;
  if (week < 1) {
    year -= 1;
    week = 52;
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function bpsOf(amount: number, bps: number): number {
  return Math.floor((amount * bps) / 10000);
}

/**
 * Loyalty discounts for signed-in members only.
 * Applies to product subtotal (before delivery). Stack: volume %, then streak %, then cashback.
 */
export function computeLoyaltyQuote(input: {
  settings: Settings;
  customer: LoyaltyCustomerSnapshot | null;
  cartProductQty: number;
  productSubtotalCentavos: Centavos;
  pickupDate: Date;
}): LoyaltyQuote {
  const empty: LoyaltyQuote = {
    volumeDiscountCentavos: 0,
    streakDiscountCentavos: 0,
    cashbackAppliedCentavos: 0,
    discountCentavos: 0,
    cashbackEarnedCentavos: 0,
    labels: [],
    volumeUnlocked: false,
    streakUnlocked: false,
    piecesTowardVolume: input.customer?.lifetimeProductQty ?? 0,
    volumeThreshold: input.settings.loyaltyVolumeThreshold,
    streakWeeks: input.settings.loyaltyStreakWeeks,
    currentStreak: input.customer?.weeklyOrderStreak ?? 0,
  };

  if (!input.settings.loyaltyEnabled || !input.customer) {
    return empty;
  }

  const threshold = Math.max(1, input.settings.loyaltyVolumeThreshold);
  const streakNeed = Math.max(1, input.settings.loyaltyStreakWeeks);
  const lifetimeAfter = input.customer.lifetimeProductQty + input.cartProductQty;
  const volumeUnlocked = lifetimeAfter >= threshold;

  // Streak unlocked if already at threshold, OR this week continues a streak that would hit it.
  const thisWeek = manilaWeekKey(input.pickupDate);
  const last = input.customer.lastStreakPickupWeekKey;
  let projectedStreak = input.customer.weeklyOrderStreak;
  if (!last) {
    projectedStreak = 1;
  } else if (last === thisWeek) {
    projectedStreak = input.customer.weeklyOrderStreak;
  } else if (last === previousWeekKey(thisWeek)) {
    projectedStreak = input.customer.weeklyOrderStreak + 1;
  } else {
    projectedStreak = 1;
  }
  // Reward when they've already completed the streak weeks before this order,
  // or when this order seals the Nth consecutive week.
  const streakUnlocked =
    input.customer.weeklyOrderStreak >= streakNeed || projectedStreak >= streakNeed;

  let remaining = Math.max(0, input.productSubtotalCentavos);
  let volumeDiscount = 0;
  let streakDiscount = 0;
  const labels: string[] = [];

  if (volumeUnlocked && input.settings.loyaltyVolumeDiscountBps > 0) {
    volumeDiscount = Math.min(
      remaining,
      bpsOf(remaining, input.settings.loyaltyVolumeDiscountBps),
    );
    remaining -= volumeDiscount;
    labels.push(
      `${(input.settings.loyaltyVolumeDiscountBps / 100).toFixed(0)}% member volume discount`,
    );
  }

  if (streakUnlocked && input.settings.loyaltyStreakDiscountBps > 0) {
    streakDiscount = Math.min(
      remaining,
      bpsOf(remaining, input.settings.loyaltyStreakDiscountBps),
    );
    remaining -= streakDiscount;
    labels.push(
      `${(input.settings.loyaltyStreakDiscountBps / 100).toFixed(0)}% streak discount (${streakNeed} weeks)`,
    );
  }

  const cashbackApplied = Math.min(input.customer.cashbackBalanceCentavos, remaining);
  if (cashbackApplied > 0) {
    remaining -= cashbackApplied;
    labels.push("Cashback redeemed");
  }

  const afterDiscount = Math.max(0, input.productSubtotalCentavos - volumeDiscount - streakDiscount - cashbackApplied);
  const per100 = Math.max(0, input.settings.loyaltyCashbackPer100Centavos);
  const cashbackEarned =
    per100 > 0 ? Math.floor(afterDiscount / 10000) * per100 : 0;

  return {
    volumeDiscountCentavos: volumeDiscount,
    streakDiscountCentavos: streakDiscount,
    cashbackAppliedCentavos: cashbackApplied,
    discountCentavos: volumeDiscount + streakDiscount + cashbackApplied,
    cashbackEarnedCentavos: cashbackEarned,
    labels,
    volumeUnlocked,
    streakUnlocked,
    piecesTowardVolume: Math.min(lifetimeAfter, threshold),
    volumeThreshold: threshold,
    streakWeeks: streakNeed,
    currentStreak: input.customer.weeklyOrderStreak,
  };
}

/** Update streak / lifetime qty / cashback after an order is marked paid. */
export function nextLoyaltyState(input: {
  customer: LoyaltyCustomerSnapshot;
  pickupDate: Date;
  productQty: number;
  cashbackAppliedCentavos: number;
  cashbackEarnedCentavos: number;
}): {
  lifetimeProductQty: number;
  weeklyOrderStreak: number;
  lastStreakPickupWeekKey: string;
  cashbackBalanceCentavos: number;
} {
  const thisWeek = manilaWeekKey(input.pickupDate);
  const last = input.customer.lastStreakPickupWeekKey;
  let streak = input.customer.weeklyOrderStreak;

  if (!last) {
    streak = 1;
  } else if (last === thisWeek) {
    // Same week — keep streak as-is (already counted).
    streak = Math.max(1, streak);
  } else if (last === previousWeekKey(thisWeek)) {
    streak = streak + 1;
  } else {
    streak = 1;
  }

  const balance =
    Math.max(0, input.customer.cashbackBalanceCentavos - input.cashbackAppliedCentavos) +
    Math.max(0, input.cashbackEarnedCentavos);

  return {
    lifetimeProductQty: input.customer.lifetimeProductQty + input.productQty,
    weeklyOrderStreak: streak,
    lastStreakPickupWeekKey: thisWeek,
    cashbackBalanceCentavos: balance,
  };
}
