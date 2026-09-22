import type { Metadata } from "next";
import Link from "next/link";
import { isStaff, requireCustomer } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPeso } from "@/lib/money";
import { formatDay } from "@/lib/time";
import { Card, Eyebrow, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { AccountOrderHistory } from "@/components/account-order-history";
import { InstallAppButton } from "@/components/install-app";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireCustomer();
  const staff = isStaff(user);
  const [settings, customer, orders] = await Promise.all([
    getSettings(),
    db.customer.findUnique({ where: { userId: user.id } }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    }),
  ]);

  const lifetime = customer?.lifetimeProductQty ?? 0;
  const streak = customer?.weeklyOrderStreak ?? 0;
  const cashback = customer?.cashbackBalanceCentavos ?? 0;
  const volumeNeed = Math.max(1, settings.loyaltyVolumeThreshold);
  const streakNeed = Math.max(1, settings.loyaltyStreakWeeks);
  const volumePct = Math.min(100, Math.round((lifetime / volumeNeed) * 100));
  const streakPct = Math.min(100, Math.round((streak / streakNeed) * 100));
  const volumeUnlocked = lifetime >= volumeNeed;
  const streakUnlocked = streak >= streakNeed;
  const cashbackRate = settings.loyaltyCashbackPer100Centavos;

  const orderRows = orders.map((order) => ({
    id: order.id,
    code: order.code,
    accessToken: order.accessToken,
    pickupDateLabel: formatDay(order.pickupDate),
    itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
    totalCentavos: order.totalCentavos,
    discountCentavos: order.discountCentavos,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
  }));

  return (
    <div className="shell grid gap-10 py-12 md:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Account</Eyebrow>
          <h1 className="text-[2.4rem] leading-[1]">Hello, {user.name.split(" ")[0]}</h1>
          <p className="muted text-sm">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {staff ? (
            <Link href="/admin" className="btn btn-primary btn-sm">
              Open admin
            </Link>
          ) : null}
          <form action={logoutAction}>
            <SubmitButton variant="ghost" small>
              Sign out
            </SubmitButton>
          </form>
        </div>
      </header>

      {staff ? (
        <Notice tone="info" title="Admin account">
          You are signed in with bakery access. Use <strong>Open admin</strong> or the Admin button
          in the header to manage the desk.
        </Notice>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="grid gap-1">
          <p className="font-display text-xl leading-tight">Install Woof King</p>
          <p className="muted text-sm leading-6">
            Put the bakery on your phone home screen or open it like an app on your computer.
          </p>
        </div>
        <InstallAppButton variant="primary" label="Get the app" />
      </Card>

      {settings.loyaltyEnabled ? (
        <section className="grid gap-4">
          <div className="grid gap-2">
            <h2 className="font-display text-2xl">Member perks</h2>
            <p className="muted max-w-2xl text-sm leading-6">
              These rewards only apply when you order while signed in. Staff can adjust the rules
              anytime from bakery settings.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="grid gap-3 p-5">
              <p className="eyebrow">Volume</p>
              <p className="font-display text-xl leading-tight">
                {volumeUnlocked
                  ? `${(settings.loyaltyVolumeDiscountBps / 100).toFixed(0)}% off unlocked`
                  : `${lifetime} / ${volumeNeed} pieces`}
              </p>
              <p className="muted text-xs leading-5">
                Buy {volumeNeed} products (lifetime, paid) to unlock a{" "}
                {(settings.loyaltyVolumeDiscountBps / 100).toFixed(0)}% discount on product
                subtotals.
              </p>
              <ProgressBar value={volumePct} />
            </Card>

            <Card className="grid gap-3 p-5">
              <p className="eyebrow">Weekly streak</p>
              <p className="font-display text-xl leading-tight">
                {streakUnlocked
                  ? `${(settings.loyaltyStreakDiscountBps / 100).toFixed(0)}% streak reward`
                  : `${streak} / ${streakNeed} weeks`}
              </p>
              <p className="muted text-xs leading-5">
                Order {streakNeed} consecutive pickup weeks for an extra{" "}
                {(settings.loyaltyStreakDiscountBps / 100).toFixed(0)}% off. Miss a week and the
                streak resets.
              </p>
              <ProgressBar value={streakPct} />
            </Card>

            <Card className="grid gap-3 p-5">
              <p className="eyebrow">Cashback</p>
              <p className="font-display text-xl leading-tight">{formatPeso(cashback)}</p>
              <p className="muted text-xs leading-5">
                Earn {formatPeso(cashbackRate)} for every ₱100 of product spend after discounts.
                Balance is applied automatically at checkout.
              </p>
            </Card>
          </div>

          {!volumeUnlocked && !streakUnlocked && cashback === 0 ? (
            <Notice tone="info" title="Start earning">
              Place a paid order while signed in — pieces, streak weeks, and cashback update once
              payment is confirmed.
            </Notice>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4">
        <div className="grid gap-2">
          <h2 className="font-display text-2xl">Order history</h2>
          <p className="muted text-sm leading-6">
            Switch between pending and completed orders. Tap an order code to open its receipt and
            payment page.
          </p>
        </div>
        <AccountOrderHistory orders={orderRows} />
      </section>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--ember)] transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
