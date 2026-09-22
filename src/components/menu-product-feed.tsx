"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { cn } from "@/lib/cn";
import type { MenuItemWithProduct } from "@/domain/menu";
import { CATEGORY_OPTIONS } from "@/lib/brand";

/**
 * Mobile-only Instagram-style sub-tabs above the product list.
 * Desktop still renders a plain grid via the same children path.
 */
export function MenuProductFeed({
  items,
  inBasket,
  closed,
}: {
  items: MenuItemWithProduct[];
  inBasket: Map<string, number>;
  closed: boolean;
}) {
  const categories = useMemo(() => {
    const present = new Set(items.map((item) => item.product.category));
    return CATEGORY_OPTIONS.filter((c) => present.has(c.id));
  }, [items]);

  const [tab, setTab] = useState<string>("all");

  const filtered =
    tab === "all" ? items : items.filter((item) => item.product.category === tab);

  return (
    <div className="grid gap-5">
      {/* Sub-tabs: phone only */}
      <div className="sticky top-[3.75rem] z-20 -mx-1 bg-[var(--ink)] py-2 md:hidden">
        <div
          role="tablist"
          aria-label="Menu sections"
          className="flex gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <SubTab
            active={tab === "all"}
            onClick={() => setTab("all")}
            label={`All · ${items.length}`}
          />
          {categories.map((cat) => {
            const count = items.filter((i) => i.product.category === cat.id).length;
            return (
              <SubTab
                key={cat.id}
                active={tab === cat.id}
                onClick={() => setTab(cat.id)}
                label={`${cat.label} · ${count}`}
              />
            );
          })}
        </div>
      </div>

      <div className="menu-list">
        {filtered.map((item, index) => (
          <ProductCard
            key={item.id}
            item={item}
            index={tab === "all" ? index : items.findIndex((i) => i.id === item.id)}
            inBasket={inBasket.get(item.id) ?? 0}
            closed={closed}
            revealDelay={index * 40}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="muted text-sm md:hidden">Nothing in this section this week.</p>
      ) : null}
    </div>
  );
}

function SubTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-[0.78rem] font-semibold tracking-wide transition-colors",
        active
          ? "bg-[var(--ember)] text-[var(--on-ember)]"
          : "border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
      )}
    >
      {label}
    </button>
  );
}
