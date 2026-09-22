"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPeso } from "@/lib/money";
import { Card, Chip, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";

export type AccountOrderRow = {
  id: string;
  code: string;
  accessToken: string;
  pickupDateLabel: string;
  itemCount: number;
  totalCentavos: number;
  discountCentavos: number;
  paymentStatus: string;
  fulfillmentStatus: string;
};

function isCompleted(order: AccountOrderRow): boolean {
  return (
    order.fulfillmentStatus === "completed" || order.fulfillmentStatus === "cancelled"
  );
}

function statusLabel(order: AccountOrderRow): string {
  if (order.fulfillmentStatus === "cancelled") return "cancelled";
  if (order.fulfillmentStatus === "completed") return "completed";
  if (order.paymentStatus !== "paid") return order.paymentStatus;
  return order.fulfillmentStatus;
}

function statusTone(order: AccountOrderRow): "sage" | "ember" | "neutral" | "danger" {
  if (order.fulfillmentStatus === "completed") return "sage";
  if (order.fulfillmentStatus === "cancelled") return "neutral";
  if (order.paymentStatus === "paid") return "sage";
  if (order.paymentStatus === "failed") return "danger";
  return "ember";
}

export function AccountOrderHistory({ orders }: { orders: AccountOrderRow[] }) {
  const [tab, setTab] = useState<"pending" | "completed">("pending");

  const pending = orders.filter((o) => !isCompleted(o));
  const completed = orders.filter((o) => isCompleted(o));
  const shown = tab === "pending" ? pending : completed;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        action={
          <Link href="/menu" className="btn btn-primary btn-sm">
            See this week&apos;s table
          </Link>
        }
      >
        When you place an order while signed in, it will show up here.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order history">
        <TabButton
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          count={pending.length}
        >
          Pending
        </TabButton>
        <TabButton
          active={tab === "completed"}
          onClick={() => setTab("completed")}
          count={completed.length}
        >
          Completed
        </TabButton>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "Nothing pending" : "No completed orders yet"}
          action={
            tab === "pending" ? (
              <Link href="/menu" className="btn btn-primary btn-sm">
                Order this week
              </Link>
            ) : undefined
          }
        >
          {tab === "pending"
            ? "Paid and unfinished orders stay here until the bakery marks them collected or delivered."
            : "Finished and cancelled orders will appear in this list."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3" role="tabpanel">
          {shown.map((order) => (
            <li key={order.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="grid gap-1">
                  <Link
                    href={`/order/${order.code}?token=${order.accessToken}`}
                    className="font-display text-lg hover:text-[var(--ember-glow)]"
                  >
                    {order.code}
                  </Link>
                  <p className="muted text-xs">
                    {order.pickupDateLabel} · {order.itemCount} item
                    {order.itemCount === 1 ? "" : "s"} · {formatPeso(order.totalCentavos)}
                    {order.discountCentavos > 0
                      ? ` · saved ${formatPeso(order.discountCentavos)}`
                      : ""}
                  </p>
                </div>
                <Chip tone={statusTone(order)} dot>
                  {statusLabel(order)}
                </Chip>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("btn btn-sm", active ? "btn-primary" : "btn-ghost")}
    >
      {children}
      <span className={cn("ml-2 tabular-nums", active ? "opacity-90" : "muted")}>{count}</span>
    </button>
  );
}
