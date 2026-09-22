import { db } from "@/lib/db";
import { posSale } from "@/app/actions/ops";
import { formatPesoShort } from "@/lib/money";
import { Card, Eyebrow, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function AdminPosPage() {
  const products = await db.product.findMany({
    where: { archived: false, counterStock: { gt: 0 } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <Eyebrow>Walk-in</Eyebrow>
        <h1 className="text-[2.2rem] leading-[1]">Counter POS</h1>
        <p className="muted text-sm">
          Cash or GCash for finished goods on the counter. Deducts counter stock only — not raw
          ingredients.
        </p>
      </header>

      {products.length === 0 ? (
        <Notice tone="warn" title="Nothing on the counter">
          Record a production batch first so finished goods appear here.
        </Notice>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.id}>
              <Card className="grid gap-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg">{p.name}</h2>
                  <span className="price text-sm">{formatPesoShort(p.priceCentavos)}</span>
                </div>
                <p className="muted text-xs">{p.counterStock} on counter</p>
                <form action={posSale} className="grid gap-2">
                  <input type="hidden" name="productId" value={p.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Qty">
                      <input
                        name="qty"
                        type="number"
                        min={1}
                        max={p.counterStock}
                        defaultValue={1}
                      />
                    </Field>
                    <Field label="Pay">
                      <select name="method" defaultValue="cash">
                        <option value="cash">Cash</option>
                        <option value="gcash">GCash</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Customer name">
                    <input name="contactName" defaultValue="Walk-in" />
                  </Field>
                  <SubmitButton small>Sell</SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
