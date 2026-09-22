import { db } from "@/lib/db";
import { updateCustomerNotes } from "@/app/actions/admin";
import { formatPeso } from "@/lib/money";
import { formatDay } from "@/lib/time";
import { Card, Eyebrow, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminCustomersPage() {
  const customers = await db.customer.findMany({
    orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>CRM</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Customers</h1>
        <p className="muted text-sm">
          Profiles are saved from checkout but only visible here — never on the public site.
        </p>
      </header>

      {customers.length === 0 ? (
        <EmptyState title="No customers yet">They appear after the first paid order.</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {customers.map((c) => (
            <li key={c.id}>
              <Card className="grid gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h2 className="font-display text-xl">{c.name}</h2>
                    <p className="muted text-sm">
                      <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="link-underline">
                        {c.phone}
                      </a>
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                    <p className="faint text-xs">
                      {c.totalOrders} orders · {formatPeso(c.totalSpentCentavos)}
                      {c.lastOrderAt ? ` · last ${formatDay(c.lastOrderAt)}` : ""}
                      {c.userId ? " · member" : ""}
                    </p>
                    {c.userId ? (
                      <p className="faint text-xs">
                        Loyalty: {c.lifetimeProductQty} pcs · streak {c.weeklyOrderStreak} wk ·
                        cashback {formatPeso(c.cashbackBalanceCentavos)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {c.addressLine ? (
                  <p className="muted text-sm leading-6">
                    {c.addressLine}
                    {c.barangay ? `, ${c.barangay}` : ""}
                    {c.city ? `, ${c.city}` : ""}
                  </p>
                ) : null}
                <ul className="faint text-xs">
                  {c.orders.map((o) => (
                    <li key={o.id}>
                      {o.code} · {formatDay(o.pickupDate)} · {formatPeso(o.totalCentavos)} ·{" "}
                      {o.paymentStatus}
                    </li>
                  ))}
                </ul>
                <form
                  action={updateCustomerNotes.bind(null, c.id)}
                  className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                >
                  <label className="grid gap-1 text-xs font-semibold">
                    Staff notes
                    <textarea name="notes" rows={2} defaultValue={c.notes} />
                  </label>
                  <SubmitButton small variant="ghost">
                    Save notes
                  </SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
