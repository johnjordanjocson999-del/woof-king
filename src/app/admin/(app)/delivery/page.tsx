import { db } from "@/lib/db";
import {
  createDeliveryWindow,
  deleteDeliveryWindow,
  fillStandardDeliveryWindows,
  toggleDeliveryWindow,
} from "@/app/actions/delivery";
import { manilaDateKey, formatDay, formatClock } from "@/lib/time";
import { Card, Chip, Eyebrow, EmptyState, Notice } from "@/components/ui";
import { SubmitButton, ConfirmSubmit } from "@/components/form";

export default async function AdminDeliveryPage() {
  const [menus, windows] = await Promise.all([
    db.weeklyMenu.findMany({
      where: { status: { in: ["draft", "published"] } },
      orderBy: { pickupDate: "desc" },
      take: 6,
    }),
    db.deliveryWindow.findMany({
      orderBy: [{ date: "asc" }, { start: "asc" }],
      include: {
        menu: { select: { id: true, title: true, status: true } },
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const activeMenu = menus.find((m) => m.status === "published") ?? menus[0] ?? null;
  const defaultDate = activeMenu ? manilaDateKey(activeMenu.pickupDate) : manilaDateKey(new Date());

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Fulfillment</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Delivery windows</h1>
        <p className="muted max-w-xl text-sm leading-6">
          Standard availability is Saturday and Sunday only — 9:00–11:00 and 15:00–18:00. Publishing
          a weekly menu creates these four slots automatically.
        </p>
      </header>

      {activeMenu ? (
        <Card className="grid gap-4 p-5">
          <Notice tone="info" title="Fill this week">
            Replaces empty windows for <strong>{activeMenu.title}</strong> with Sat/Sun morning
            (9–11) and afternoon (3–6). Windows that already have orders are kept.
          </Notice>
          <form action={fillStandardDeliveryWindows}>
            <input type="hidden" name="menuId" value={activeMenu.id} />
            <SubmitButton>Apply Sat/Sun 9–11 &amp; 3–6</SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card className="grid gap-5 p-5">
        <h2 className="font-display text-xl">Add a window</h2>
        <form action={createDeliveryWindow} className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            Weekly menu
            <select name="menuId" defaultValue={activeMenu?.id ?? ""} required>
              {menus.length === 0 ? (
                <option value="">Publish a weekly menu first</option>
              ) : (
                menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.title} · {formatDay(menu.pickupDate)} ({menu.status})
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            Date
            <input name="date" type="date" required defaultValue={defaultDate} />
          </label>
          <label>
            Label
            <input name="label" placeholder="Sunday morning" defaultValue="Sunday morning" />
          </label>
          <label>
            Available from
            <input name="start" type="time" required defaultValue="09:00" />
          </label>
          <label>
            Available until
            <input name="end" type="time" required defaultValue="11:00" />
          </label>
          <label>
            Capacity
            <input name="capacity" type="number" min={1} max={200} defaultValue={15} />
          </label>
          <label className="sm:col-span-2">
            Notes (staff only)
            <input name="notes" placeholder="e.g. Candelaria / Lucena area only before noon" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton disabled={menus.length === 0}>Save window</SubmitButton>
          </div>
        </form>
      </Card>

      <section className="grid gap-3">
        <h2 className="font-display text-xl">This week&apos;s availability</h2>
        {windows.length === 0 ? (
          <EmptyState title="No delivery windows yet">
            Use “Apply Sat/Sun 9–11 &amp; 3–6” above, or add a custom window.
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {windows.map((window) => (
              <li key={window.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{window.label}</strong>
                      <Chip tone={window.active ? "sage" : "danger"} dot>
                        {window.active ? "Open" : "Hidden"}
                      </Chip>
                    </div>
                    <p className="muted text-xs leading-5">
                      {formatDay(window.date)} · {formatClock(window.start)} –{" "}
                      {formatClock(window.end)} · {window._count.orders}/{window.capacity} booked
                      {window.menu ? ` · ${window.menu.title}` : ""}
                    </p>
                    {window.notes ? (
                      <p className="faint text-xs leading-5">{window.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleDeliveryWindow}>
                      <input type="hidden" name="id" value={window.id} />
                      <SubmitButton small variant="ghost">
                        {window.active ? "Hide" : "Show"}
                      </SubmitButton>
                    </form>
                    <form action={deleteDeliveryWindow}>
                      <input type="hidden" name="id" value={window.id} />
                      <ConfirmSubmit small variant="danger" message="Delete this delivery window?">
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
