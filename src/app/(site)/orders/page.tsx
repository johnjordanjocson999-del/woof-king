import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { rememberOrder } from "@/lib/tracked-orders";
import { getActiveOrdersForVisitor } from "@/domain/active-orders";
import { Eyebrow, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Find an order" };

async function lookupOrder(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (!code || phone.length < 10) return;

  const order = await db.order.findUnique({ where: { code } });
  if (!order) return;
  const orderPhone = order.contactPhone.replace(/\D/g, "");
  if (!orderPhone.endsWith(phone.slice(-10)) && !phone.endsWith(orderPhone.slice(-10))) {
    return;
  }
  await rememberOrder(order.code, order.accessToken);
  redirect(`/order/${order.code}?token=${order.accessToken}`);
}

export default async function OrdersLookupPage() {
  const user = await currentUser();
  const active = await getActiveOrdersForVisitor(user?.id);

  return (
    <div className="shell grid max-w-lg gap-8 py-12 md:py-16">
      <header className="grid gap-3">
        <Eyebrow>Orders</Eyebrow>
        <h1 className="text-[2.4rem] leading-[1]">
          {active.length > 0 ? "Your active orders" : "Find your order"}
        </h1>
        <p className="muted text-sm leading-6">
          {active.length > 0
            ? "Tap an order to open its status. Look up another order below if you need to."
            : "Enter the code from your confirmation and the phone number you used at checkout."}
        </p>
      </header>

      {active.length > 0 ? (
        <ul className="grid gap-2.5">
          {active.map((order) => (
            <li key={order.code}>
              <Link
                href={`/order/${order.code}/status?token=${encodeURIComponent(order.token)}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors active:bg-[var(--surface)]",
                  order.urgency === "high"
                    ? "border-[color-mix(in_oklab,var(--ember)_45%,var(--line))] bg-[color-mix(in_oklab,var(--surface)_85%,var(--ember)_10%)]"
                    : "border-[var(--line)] bg-[var(--surface)]",
                )}
              >
                <span className="grid gap-0.5">
                  <span className="font-display text-lg leading-tight text-[var(--paper)]">
                    {order.headline}
                  </span>
                  <span className="muted text-xs leading-5">{order.detail}</span>
                </span>
                <span className="shrink-0 text-[var(--ember)]" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={lookupOrder} className="grid gap-4">
        {active.length > 0 ? (
          <p className="eyebrow m-0">Look up another</p>
        ) : null}
        <Field label="Order code" required>
          <input name="code" required placeholder="WK-XXXXXX" className="uppercase" />
        </Field>
        <Field label="Phone number" required>
          <input name="phone" type="tel" required placeholder="09XX XXX XXXX" />
        </Field>
        <SubmitButton>Look up</SubmitButton>
      </form>
      <Notice tone="info">
        Guest checkouts do not need an account. Keep the confirmation link — it is the private key
        to your order.
      </Notice>
    </div>
  );
}
