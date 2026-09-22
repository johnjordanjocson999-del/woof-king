import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  createPaymentOption,
  updatePaymentOption,
  togglePaymentOption,
  deletePaymentOption,
} from "@/app/actions/payment-options";
import { confirmPaymentForm, rejectPaymentForm } from "@/app/actions/payment-review";
import { formatPeso } from "@/lib/money";
import {
  WEEKDAYS_SHORT,
  addDays,
  formatDateTime,
  formatDay,
  fromManila,
  manilaDateKey,
  manilaMonthKey,
  manilaParts,
  manilaStartOfDay,
} from "@/lib/time";
import { Card, Chip, Eyebrow, Field, Notice, EmptyState } from "@/components/ui";
import { SubmitButton, ConfirmSubmit } from "@/components/form";
import { cn } from "@/lib/cn";

type Tab = "review" | "history" | "calendar" | "channels";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; day?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const tab = (["review", "history", "calendar", "channels"].includes(sp.tab ?? "")
    ? sp.tab
    : "review") as Tab;

  const now = new Date();
  const monthKey = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : manilaMonthKey(now);
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = fromManila(year, month, 1, 0, 0);
  const nextMonth = month === 12 ? fromManila(year + 1, 1, 1, 0, 0) : fromManila(year, month + 1, 1, 0, 0);
  const selectedDay = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;

  const [reviewPayments, historyPayments, monthPayments, options, reviewCount] =
    await Promise.all([
      db.payment.findMany({
        where: { status: { in: ["submitted", "pending"] } },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          order: {
            include: {
              items: true,
              pickupSlot: true,
              deliveryWindow: true,
            },
          },
        },
      }),
      db.payment.findMany({
        where: selectedDay
          ? {
              OR: [
                {
                  paidAt: {
                    gte: manilaStartOfDay(fromManila(...parseYmd(selectedDay), 0, 0)),
                    lt: addDays(manilaStartOfDay(fromManila(...parseYmd(selectedDay), 0, 0)), 1),
                  },
                },
                {
                  paidAt: null,
                  createdAt: {
                    gte: manilaStartOfDay(fromManila(...parseYmd(selectedDay), 0, 0)),
                    lt: addDays(manilaStartOfDay(fromManila(...parseYmd(selectedDay), 0, 0)), 1),
                  },
                },
              ],
            }
          : {},
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: { order: { include: { items: true } } },
      }),
      db.payment.findMany({
        where: {
          OR: [
            { paidAt: { gte: monthStart, lt: nextMonth } },
            { paidAt: null, createdAt: { gte: monthStart, lt: nextMonth } },
          ],
        },
        select: { id: true, status: true, amountCentavos: true, paidAt: true, createdAt: true },
      }),
      db.paymentOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.payment.count({ where: { status: { in: ["submitted", "pending"] } } }),
    ]);

  const byDay = new Map<string, { count: number; paid: number; pending: number; total: number }>();
  for (const p of monthPayments) {
    const key = manilaDateKey(p.paidAt ?? p.createdAt);
    const row = byDay.get(key) ?? { count: 0, paid: 0, pending: 0, total: 0 };
    row.count += 1;
    row.total += p.amountCentavos;
    if (p.status === "paid") row.paid += 1;
    else row.pending += 1;
    byDay.set(key, row);
  }

  const calendarDays = buildMonthCells(year, month);
  const prevMonth =
    month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const followingMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Money in</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Payments</h1>
        <p className="muted max-w-2xl text-sm leading-6">
          Review online proofs, open full order details, browse payment history, and track days on
          the calendar.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payments sections">
        <TabLink href="/admin/payments?tab=review" active={tab === "review"} badge={reviewCount}>
          Review
        </TabLink>
        <TabLink href="/admin/payments?tab=history" active={tab === "history"}>
          History
        </TabLink>
        <TabLink href="/admin/payments?tab=calendar" active={tab === "calendar"}>
          Calendar
        </TabLink>
        <TabLink href="/admin/payments?tab=channels" active={tab === "channels"}>
          Channels
        </TabLink>
      </div>

      {tab === "review" ? (
        <ReviewTab payments={reviewPayments} />
      ) : null}
      {tab === "history" ? (
        <HistoryTab payments={historyPayments} selectedDay={selectedDay} />
      ) : null}
      {tab === "calendar" ? (
        <CalendarTab
          monthKey={monthKey}
          prevMonth={prevMonth}
          nextMonth={followingMonth}
          cells={calendarDays}
          byDay={byDay}
          selectedDay={selectedDay}
        />
      ) : null}
      {tab === "channels" ? <ChannelsTab options={options} /> : null}
    </div>
  );
}

function parseYmd(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split("-").map(Number);
  return [y, m, d];
}

function buildMonthCells(year: number, month: number) {
  const first = fromManila(year, month, 1, 12, 0);
  const startWeekday = manilaParts(first).weekday;
  const nextMonthStart =
    month === 12 ? fromManila(year + 1, 1, 1, 12, 0) : fromManila(year, month + 1, 1, 12, 0);
  const lastDay = manilaParts(addDays(nextMonthStart, -1)).day;

  const cells: Array<{ key: string | null; day: number | null }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ key: null, day: null });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({
      key: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ key: null, day: null });
  return cells;
}

function TabLink({
  href,
  active,
  children,
  badge,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link href={href} className={cn("btn btn-sm", active ? "btn-primary" : "btn-ghost")}>
      {children}
      {typeof badge === "number" && badge > 0 ? (
        <span className={cn("ml-2 tabular-nums", active ? "opacity-90" : "text-[var(--ember)]")}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ReviewTab({
  payments,
}: {
  payments: Array<{
    id: string;
    status: string;
    method: string | null;
    provider: string;
    amountCentavos: number;
    proofPath: string | null;
    referenceNote: string;
    providerPaymentId: string | null;
    createdAt: Date;
    order: {
      id: string;
      code: string;
      accessToken: string;
      contactName: string;
      contactPhone: string;
      contactEmail: string | null;
      fulfillment: string;
      paymentStatus: string;
      fulfillmentStatus: string;
      totalCentavos: number;
      pickupDate: Date;
      deliveryAddress: string;
      notes: string;
      items: Array<{ id: string; quantity: number; nameSnapshot: string }>;
      pickupSlot: { start: string; label: string } | null;
      deliveryWindow: { label: string; start: string; end: string; date: Date } | null;
    };
  }>;
}) {
  if (payments.length === 0) {
    return (
      <EmptyState title="Nothing to review">
        When a customer submits a transfer reference or proof, it shows up here.
      </EmptyState>
    );
  }

  return (
    <section className="grid gap-4">
      <Notice tone="info" title="Review queue">
        Check the proof or reference, open the order if needed, then confirm paid — or ask for a
        clearer screenshot.
      </Notice>
      <ul className="grid gap-4">
        {payments.map((p) => (
          <li key={p.id}>
            <Card className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_11rem]">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/orders/${p.order.code}`}
                        className="font-display text-xl hover:text-[var(--ember-glow)]"
                      >
                        {p.order.code}
                      </Link>
                      <Chip tone={p.status === "submitted" ? "ember" : "neutral"} dot>
                        {p.status}
                      </Chip>
                      <Chip>{p.method || p.provider}</Chip>
                    </div>
                    <p className="muted text-sm">
                      {p.order.contactName} ·{" "}
                      <a href={`tel:${p.order.contactPhone.replace(/\s/g, "")}`} className="link-underline">
                        {p.order.contactPhone}
                      </a>
                      {p.order.contactEmail ? ` · ${p.order.contactEmail}` : ""}
                    </p>
                    <p className="faint text-xs">
                      {formatDay(p.order.pickupDate)} · {p.order.fulfillment} ·{" "}
                      {formatPeso(p.amountCentavos)} · submitted {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                  <span className="font-display text-2xl price leading-none">
                    {formatPeso(p.amountCentavos)}
                  </span>
                </div>

                {p.referenceNote || p.providerPaymentId ? (
                  <p className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm">
                    <span className="faint text-xs uppercase tracking-wide">Reference</span>
                    <br />
                    {p.providerPaymentId ? <strong>{p.providerPaymentId}</strong> : null}
                    {p.referenceNote ? (
                      <span className="muted">
                        {p.providerPaymentId ? " · " : ""}
                        {p.referenceNote}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                <ul className="muted text-sm">
                  {p.order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.nameSnapshot}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/orders/${p.order.code}`} className="btn btn-ghost btn-sm">
                    Order details
                  </Link>
                  <Link
                    href={`/order/${p.order.code}?token=${p.order.accessToken}`}
                    className="btn btn-ghost btn-sm"
                    target="_blank"
                  >
                    Customer page
                  </Link>
                  {p.status === "submitted" || p.status === "pending" ? (
                    <form action={confirmPaymentForm}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <SubmitButton small>Confirm paid</SubmitButton>
                    </form>
                  ) : null}
                  {p.status === "submitted" ? (
                    <form action={rejectPaymentForm} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input
                        name="note"
                        placeholder="Reason (optional)"
                        className="min-w-[10rem] flex-1"
                      />
                      <SubmitButton small variant="ghost">
                        Ask again
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2">
                {p.proofPath ? (
                  <a
                    href={p.proofPath}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white md:aspect-square"
                  >
                    <Image
                      src={p.proofPath}
                      alt="Payment proof"
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 90vw, 320px"
                      className="object-contain p-1"
                    />
                  </a>
                ) : (
                  <div className="grid aspect-square place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] text-center text-xs text-[var(--faint)]">
                    No screenshot
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryTab({
  payments,
  selectedDay,
}: {
  payments: Array<{
    id: string;
    status: string;
    method: string | null;
    provider: string;
    amountCentavos: number;
    proofPath: string | null;
    referenceNote: string;
    providerPaymentId: string | null;
    createdAt: Date;
    paidAt: Date | null;
    order: {
      code: string;
      contactName: string;
      contactPhone: string;
      fulfillment: string;
      items: Array<{ id: string; quantity: number; nameSnapshot: string }>;
    };
  }>;
  selectedDay: string | null;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">Payment history</h2>
          <p className="muted text-xs">
            {selectedDay
              ? `Showing ${selectedDay}. `
              : "Latest 100 payments. "}
            Pick a day on the Calendar tab to filter.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedDay ? (
            <Link href="/admin/payments?tab=history" className="btn btn-ghost btn-sm">
              Clear day filter
            </Link>
          ) : null}
          <Link href="/admin/payments?tab=calendar" className="btn btn-ghost btn-sm">
            Open calendar
          </Link>
        </div>
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No payments in this view">Try another day or clear the filter.</EmptyState>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {payments.map((p) => (
              <li
                key={p.id}
                className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-0.5">
                    <Link
                      href={`/admin/orders/${p.order.code}`}
                      className="font-display text-lg link-underline"
                    >
                      {p.order.code}
                    </Link>
                    <p className="text-sm">{p.order.contactName}</p>
                    <p className="faint text-xs">{formatDateTime(p.paidAt ?? p.createdAt)}</p>
                  </div>
                  <Chip
                    tone={
                      p.status === "paid" ? "sage" : p.status === "submitted" ? "ember" : "neutral"
                    }
                    dot
                  >
                    {p.status}
                  </Chip>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="muted">{p.method || p.provider}</span>
                  <span className="price font-semibold">{formatPeso(p.amountCentavos)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.proofPath ? (
                    <a
                      href={p.proofPath}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      Proof
                    </a>
                  ) : null}
                  <Link href={`/admin/orders/${p.order.code}`} className="btn btn-ghost btn-sm">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] md:block">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                    <td>
                      <Link
                        href={`/admin/orders/${p.order.code}`}
                        className="link-underline font-semibold"
                      >
                        {p.order.code}
                      </Link>
                    </td>
                    <td className="text-sm">
                      {p.order.contactName}
                      <br />
                      <span className="faint text-xs">{p.order.contactPhone}</span>
                    </td>
                    <td className="text-xs">{p.method || p.provider}</td>
                    <td className="num price">{formatPeso(p.amountCentavos)}</td>
                    <td>
                      <Chip
                        tone={
                          p.status === "paid"
                            ? "sage"
                            : p.status === "submitted"
                              ? "ember"
                              : "neutral"
                        }
                        dot
                      >
                        {p.status}
                      </Chip>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.proofPath ? (
                          <a
                            href={p.proofPath}
                            target="_blank"
                            rel="noreferrer"
                            className="link-underline text-xs"
                          >
                            Proof
                          </a>
                        ) : null}
                        <Link
                          href={`/admin/orders/${p.order.code}`}
                          className="link-underline text-xs"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function CalendarTab({
  monthKey,
  prevMonth,
  nextMonth,
  cells,
  byDay,
  selectedDay,
}: {
  monthKey: string;
  prevMonth: string;
  nextMonth: string;
  cells: Array<{ key: string | null; day: number | null }>;
  byDay: Map<string, { count: number; paid: number; pending: number; total: number }>;
  selectedDay: string | null;
}) {
  const [y, m] = monthKey.split("-").map(Number);
  const title = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    fromManila(y, m, 1, 12, 0),
  );
  const todayKey = manilaDateKey(new Date());

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">{title}</h2>
          <p className="muted text-xs">Tap a day to open its payment history.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/payments?tab=calendar&month=${prevMonth}`} className="btn btn-ghost btn-sm">
            ← Prev
          </Link>
          <Link href={`/admin/payments?tab=calendar&month=${nextMonth}`} className="btn btn-ghost btn-sm">
            Next →
          </Link>
        </div>
      </div>

      <Card className="grid gap-3 p-4 sm:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--faint)]">
          {WEEKDAYS_SHORT.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, idx) => {
            if (!cell.key || cell.day == null) {
              return <div key={`empty-${idx}`} className="min-h-[4.5rem]" />;
            }
            const stats = byDay.get(cell.key);
            const active = selectedDay === cell.key;
            const isToday = cell.key === todayKey;
            return (
              <Link
                key={cell.key}
                href={`/admin/payments?tab=history&day=${cell.key}&month=${monthKey}`}
                className={cn(
                  "grid min-h-[4.5rem] content-start gap-1 rounded-[var(--radius-sm)] border p-2 text-left transition-colors",
                  active
                    ? "border-[var(--ember)] bg-[color-mix(in_oklab,var(--ember)_16%,transparent)]"
                    : isToday
                      ? "border-[var(--ember)]/50 bg-[var(--surface-2)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]",
                )}
              >
                <span className={cn("font-display text-sm", isToday && "text-[var(--ember-glow)]")}>
                  {cell.day}
                </span>
                {stats ? (
                  <>
                    <span className="text-[0.65rem] leading-tight text-[var(--muted)]">
                      {stats.count} pay
                      {stats.pending > 0 ? ` · ${stats.pending} open` : ""}
                    </span>
                    <span className="price text-[0.65rem] tnum">
                      ₱{Math.round(stats.total / 100).toLocaleString("en-PH")}
                    </span>
                  </>
                ) : (
                  <span className="faint text-[0.6rem]">—</span>
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      {selectedDay ? (
        <p className="muted text-sm">
          Filtered history for <strong>{selectedDay}</strong>.{" "}
          <Link href={`/admin/payments?tab=history&day=${selectedDay}`} className="link-underline">
            View list
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function ChannelsTab({
  options,
}: {
  options: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    active: boolean;
    pickupOnly: boolean;
    sortOrder: number;
    availability: string;
    accountName: string;
    accountNumber: string;
    instructions: string;
    qrImagePath: string | null;
  }>;
}) {
  return (
    <div className="grid gap-8">
      <Notice tone="info" title="Payment channels">
        These are the options customers see at checkout (VYBE, MariBank, GCash, cash, etc.).
      </Notice>

      <Card className="grid gap-4 p-5">
        <h2 className="font-display text-xl">Add payment option</h2>
        <form action={createPaymentOption} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <Field label="Display name" required>
              <input name="name" required placeholder="GCash" />
            </Field>
            <Field label="Slug" hint="Leave blank to auto-generate">
              <input name="slug" placeholder="gcash" />
            </Field>
            <Field label="Type" required>
              <select name="type" defaultValue="qr">
                <option value="qr">QR + manual transfer</option>
                <option value="manual">Manual transfer only</option>
                <option value="cash">Cash (pickup only)</option>
              </select>
            </Field>
            <Field label="Availability">
              <select name="availability" defaultValue="online">
                <option value="online">Online checkout</option>
                <option value="both">Online + counter</option>
                <option value="pos">Counter only</option>
              </select>
            </Field>
            <Field label="Account name">
              <input name="accountName" placeholder="Justine Bernadeth Merano" />
            </Field>
            <Field label="Account / mobile number">
              <input name="accountNumber" placeholder="09XX XXX XXXX" />
            </Field>
          </div>
          <Field label="Instructions for customers">
            <textarea
              name="instructions"
              rows={2}
              placeholder="Scan with any InstaPay bank or e-wallet app."
            />
          </Field>
          <Field label="QR image" hint="PNG or JPG for scan payments">
            <input name="qrImage" type="file" accept="image/*" />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="pickupOnly" />
              Pickup only
            </label>
          </div>
          <SubmitButton>Add option</SubmitButton>
        </form>
      </Card>

      <div className="grid gap-4">
        <h2 className="font-display text-xl">Your options ({options.length})</h2>
        {options.length === 0 ? (
          <Notice tone="warn" title="No options yet">
            Add GCash, VYBE, MariBank, or cash above so checkout has something to show.
          </Notice>
        ) : (
          options.map((option) => (
            <Card key={option.id} className="grid gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg">{option.name}</h3>
                    <Chip tone={option.active ? "sage" : "ember"}>{option.active ? "On" : "Off"}</Chip>
                    <Chip>{option.type}</Chip>
                    {option.pickupOnly ? <Chip>Pickup only</Chip> : null}
                  </div>
                  <p className="faint text-xs">
                    slug: {option.slug} · sort {option.sortOrder} · {option.availability}
                  </p>
                </div>
                {option.qrImagePath ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded bg-white">
                    <Image src={option.qrImagePath} alt="" fill sizes="64px" className="object-contain" />
                  </div>
                ) : null}
              </div>

              <form action={updatePaymentOption} className="grid gap-3">
                <input type="hidden" name="id" value={option.id} />
                <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                  <Field label="Display name">
                    <input name="name" defaultValue={option.name} required />
                  </Field>
                  <Field label="Type">
                    <select name="type" defaultValue={option.type}>
                      <option value="qr">QR + manual transfer</option>
                      <option value="manual">Manual transfer only</option>
                      <option value="cash">Cash (pickup only)</option>
                    </select>
                  </Field>
                  <Field label="Account name">
                    <input name="accountName" defaultValue={option.accountName} />
                  </Field>
                  <Field label="Account / mobile number">
                    <input name="accountNumber" defaultValue={option.accountNumber} />
                  </Field>
                  <Field label="Sort order">
                    <input name="sortOrder" type="number" defaultValue={option.sortOrder} />
                  </Field>
                  <Field label="Availability">
                    <select name="availability" defaultValue={option.availability}>
                      <option value="online">Online checkout</option>
                      <option value="both">Online + counter</option>
                      <option value="pos">Counter only</option>
                    </select>
                  </Field>
                </div>
                <Field label="Instructions">
                  <textarea name="instructions" rows={2} defaultValue={option.instructions} />
                </Field>
                <Field label="Replace QR image">
                  <input name="qrImage" type="file" accept="image/*" />
                </Field>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="active" defaultChecked={option.active} />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="pickupOnly" defaultChecked={option.pickupOnly} />
                    Pickup only
                  </label>
                </div>
                <SubmitButton small>Save</SubmitButton>
              </form>

              <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                <form action={togglePaymentOption}>
                  <input type="hidden" name="id" value={option.id} />
                  <SubmitButton variant="ghost" small>
                    {option.active ? "Turn off" : "Turn on"}
                  </SubmitButton>
                </form>
                <form action={deletePaymentOption}>
                  <input type="hidden" name="id" value={option.id} />
                  <ConfirmSubmit message={`Delete ${option.name}?`}>Delete</ConfirmSubmit>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
