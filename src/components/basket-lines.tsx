import Image from "next/image";
import Link from "next/link";
import { formatPeso, formatPesoShort } from "@/lib/money";
import { CartStepper, RemoveLine } from "@/components/cart-controls";
import { Notice } from "@/components/ui";
import { productImageStyle } from "@/lib/product-image";
import type { ResolvedBasket } from "@/domain/basket";

/**
 * The basket contents, shared verbatim by the drawer and the /basket page.
 *
 * One component means the quantity a customer sees in the drawer and the
 * quantity they see on the page can never disagree.
 */
export function BasketLines({ basket, compact = false }: { basket: ResolvedBasket; compact?: boolean }) {
  return (
    <ul className="grid gap-4">
      {basket.lines.map((line) => (
        <li
          key={line.menuItemId}
          className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"
        >
          <Link href={`/bread/${line.product.slug}`} className="photo ratio-11">
            {line.product.imagePath ? (
              <Image
                src={line.product.imagePath}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
                style={productImageStyle(line.product)}
              />
            ) : null}
          </Link>

          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-0.5">
                <Link
                  href={`/bread/${line.product.slug}`}
                  className="font-display text-base leading-tight hover:text-[var(--ember-glow)]"
                >
                  {line.product.name}
                </Link>
                <span className="faint text-xs">
                  {formatPesoShort(line.unitPriceCentavos)} per {line.product.sellingUnit}
                </span>
              </div>
              <span className="price shrink-0 text-sm font-semibold">
                {formatPeso(line.lineTotalCentavos)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <CartStepper
                menuItemId={line.menuItemId}
                quantity={line.qty}
                max={line.remaining}
              />
              {compact ? null : (
                <RemoveLine
                  menuItemId={line.menuItemId}
                  quantity={line.qty}
                  label={line.product.name}
                />
              )}
            </div>

            {line.issue ? (
              <p className="text-[0.72rem] leading-4 text-[var(--wheat)]">{line.issue}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The money. Kept honest: flat delivery fee is shown at checkout when delivery
 * is selected, and included in the total before payment.
 */
export function BasketTotals({
  basket,
  fulfillment,
  deliveryFeeCentavos = 0,
  discountCentavos = 0,
  loyaltyLabels = [],
  /** When set (e.g. after member discounts), replaces basket.totals.totalCentavos. */
  adjustedTotalCentavos,
  adjustedVatCentavos,
}: {
  basket: ResolvedBasket;
  fulfillment?: "pickup" | "delivery";
  deliveryFeeCentavos?: number;
  discountCentavos?: number;
  loyaltyLabels?: string[];
  adjustedTotalCentavos?: number;
  adjustedVatCentavos?: number;
}) {
  const { totals } = basket;
  const discount = Math.max(0, discountCentavos);
  const productTotal =
    adjustedTotalCentavos !== undefined
      ? adjustedTotalCentavos
      : Math.max(0, totals.totalCentavos - discount);
  const vatShown =
    adjustedVatCentavos !== undefined ? adjustedVatCentavos : totals.vatCentavos;
  const grandTotal = productTotal + (fulfillment === "delivery" ? deliveryFeeCentavos : 0);

  return (
    <div className="grid gap-2 text-sm">
      <Row label={`Subtotal (${totals.itemCount} item${totals.itemCount === 1 ? "" : "s"})`}>
        {formatPeso(totals.subtotalCentavos)}
      </Row>

      {discount > 0 ? (
        <div className="grid gap-1">
          <Row label="Member savings">
            <span className="text-[var(--success)]">−{formatPeso(discount)}</span>
          </Row>
          {loyaltyLabels.length > 0 ? (
            <p className="muted text-[0.7rem] leading-4">{loyaltyLabels.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}

      {totals.vatMode !== "none" ? (
        <Row
          label={`VAT ${(totals.vatRateBps / 100).toFixed(0)}%${
            totals.vatMode === "inclusive" ? " (included)" : ""
          }`}
        >
          {formatPeso(vatShown)}
        </Row>
      ) : null}

      {fulfillment === "delivery" ? (
        <Row label="Delivery">
          {deliveryFeeCentavos > 0 ? (
            formatPeso(deliveryFeeCentavos)
          ) : (
            <span className="muted text-xs">Enter address to calculate</span>
          )}
        </Row>
      ) : fulfillment === "pickup" ? (
        <Row label="Pickup">
          <span className="text-xs text-[var(--success)]">Free</span>
        </Row>
      ) : null}

      <hr className="hairline my-1" />

      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-lg">Total due now</span>
        <span className="font-display price text-2xl">{formatPeso(grandTotal)}</span>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="muted">{label}</span>
      <span className="price">{children}</span>
    </div>
  );
}

export function BasketWarnings({ basket }: { basket: ResolvedBasket }) {
  if (basket.droppedCount === 0) return null;
  return (
    <Notice tone="warn" title="Your basket changed">
      {basket.droppedCount === 1 ? "An item is" : `${basket.droppedCount} items are`} no longer on
      this week&apos;s menu, so we took {basket.droppedCount === 1 ? "it" : "them"} out.
    </Notice>
  );
}
