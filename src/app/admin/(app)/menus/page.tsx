import { db } from "@/lib/db";
import { createWeeklyMenu, publishMenu, setMenuItems } from "@/app/actions/admin";
import { formatDateTime, formatDay } from "@/lib/time";
import { formatPesoShort } from "@/lib/money";
import { MIN_MENU_ITEMS, MAX_MENU_ITEMS } from "@/domain/menu";
import { Card, Chip, Eyebrow, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminMenusPage() {
  const [menus, products] = await Promise.all([
    db.weeklyMenu.findMany({
      orderBy: { pickupDate: "desc" },
      include: { items: { include: { product: true }, orderBy: { position: "asc" } } },
      take: 8,
    }),
    db.product.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Eyebrow>Rotation</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">Weekly menu</h1>
          <p className="muted text-sm">
            Publish with {MIN_MENU_ITEMS}–{MAX_MENU_ITEMS} products. Dates auto-fill from Thursday
            cutoff → Friday/Saturday bake → Sunday pickup.
          </p>
        </div>
        <form action={createWeeklyMenu}>
          <input type="hidden" name="title" value="This week's table" />
          <SubmitButton small>New draft week</SubmitButton>
        </form>
      </header>

      {menus.map((menu) => (
        <Card key={menu.id} className="grid gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="font-display text-xl">{menu.title}</h2>
              <p className="muted text-xs">
                Cutoff {formatDateTime(menu.cutoffAt)} · Pickup {formatDay(menu.pickupDate)}
              </p>
            </div>
            <Chip tone={menu.status === "published" ? "sage" : "ember"}>{menu.status}</Chip>
          </div>

          {menu.status !== "published" ? (
            <form action={setMenuItems} className="grid gap-4">
              <input type="hidden" name="menuId" value={menu.id} />
              <p className="text-sm font-semibold">
                Select {MIN_MENU_ITEMS}–{MAX_MENU_ITEMS} products
              </p>
              <ul className="grid gap-2">
                {products.map((p) => {
                  const existing = menu.items.find((i) => i.productId === p.id);
                  return (
                    <li
                      key={p.id}
                      className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 sm:grid-cols-[auto_1fr_6rem_6rem] sm:items-center"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="productId"
                          value={p.id}
                          defaultChecked={Boolean(existing)}
                        />
                        {p.name}
                      </label>
                      <span className="faint text-xs sm:text-right">
                        catalog {formatPesoShort(p.priceCentavos)}
                      </span>
                      <label className="grid gap-1 text-xs">
                        Price ₱
                        <input
                          name={`price_${p.id}`}
                          defaultValue={
                            existing
                              ? (existing.priceCentavos / 100).toFixed(2)
                              : (p.priceCentavos / 100).toFixed(2)
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Cap (0=∞)
                        <input
                          name={`limit_${p.id}`}
                          type="number"
                          min={0}
                          defaultValue={existing?.quantityLimit ?? 0}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <SubmitButton small variant="solid">
                Save items
              </SubmitButton>
            </form>
          ) : (
            <ul className="grid gap-1 text-sm">
              {menu.items.map((item, i) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>
                    {String(i + 1).padStart(2, "0")} {item.product.name}
                  </span>
                  <span className="muted">
                    {formatPesoShort(item.priceCentavos)} · sold {item.soldCount}
                    {item.quantityLimit > 0 ? `/${item.quantityLimit}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {menu.status === "draft" ? (
            menu.items.length >= MIN_MENU_ITEMS && menu.items.length <= MAX_MENU_ITEMS ? (
              <form
                action={async () => {
                  "use server";
                  await publishMenu(menu.id);
                }}
              >
                <SubmitButton>Publish this week</SubmitButton>
              </form>
            ) : (
              <Notice tone="warn">
                Add {MIN_MENU_ITEMS}–{MAX_MENU_ITEMS} items before publishing (now {menu.items.length}).
              </Notice>
            )
          ) : null}
        </Card>
      ))}
    </div>
  );
}
