import { listAvailabilitySlots } from "@/domain/availability";
import { manilaDateKey, manilaParts } from "@/lib/time";
import { AdminAvailabilityCalendar } from "@/components/admin-availability-calendar";
import { Eyebrow, Notice } from "@/components/ui";

export default async function AdminAvailabilityPage() {
  const now = new Date();
  const parts = manilaParts(now);
  const slots = await listAvailabilitySlots({
    from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    onlyActive: false,
  });

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Fulfillment</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Availability calendar</h1>
        <p className="muted max-w-2xl text-sm leading-6">
          Tap a day you can do pickup or delivery, then add times. Days you leave empty stay
          order-only — customers can still place orders while the menu is open, but they can only
          choose handoff on the free days you paint here.
        </p>
      </header>

      <Notice tone="info" title="How it works">
        Green days on the calendar are free. At checkout, customers pick one of those dates and a
        time band. Publishing a weekly menu no longer auto-fills Sat/Sun windows — you control the
        calendar.
      </Notice>

      <AdminAvailabilityCalendar
        initialYear={parts.year}
        initialMonth={parts.month}
        todayKey={manilaDateKey(now)}
        slots={slots.map((s) => ({
          id: s.id,
          dateKey: s.dateKey,
          kind: s.kind,
          label: s.label,
          start: s.start,
          end: s.end,
          capacity: s.capacity,
          booked: s.booked,
          active: s.active,
        }))}
      />
    </div>
  );
}
