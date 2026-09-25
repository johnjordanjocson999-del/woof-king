import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getActiveMenu, ordersOpen, remainingFor, scarcityLabel } from "@/domain/menu";
import { readCart } from "@/lib/cart";
import { formatPesoShort } from "@/lib/money";
import { formatDateTime, formatDay } from "@/lib/time";
import { productImageStyle } from "@/lib/product-image";
import { AddToBasket } from "@/components/cart-controls";
import { Chip, Notice } from "@/components/ui";
import { MobileStickyBar } from "@/components/mobile-sticky-bar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug } });
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: product.imagePath ? { images: [product.imagePath] } : undefined,
  };
}

export default async function BreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = new Date();

  const [product, settings, menu, cart] = await Promise.all([
    db.product.findUnique({ where: { slug } }),
    getSettings(),
    getActiveMenu(now),
    readCart(),
  ]);

  if (!product || product.archived) notFound();

  const item = menu?.items.find((candidate) => candidate.productId === product.id) ?? null;
  const open = ordersOpen(menu, now) && item !== null;
  const remaining = item ? remainingFor(item) : null;
  const scarcity = item ? scarcityLabel(item) : null;
  const price = item?.priceCentavos ?? product.priceCentavos;
  const allergens = product.allergens.split(",").filter(Boolean);
  const inBasket = item ? (cart.lines.find((line) => line.menuItemId === item.id)?.qty ?? 0) : 0;
  const showStickyBuy = Boolean(item && menu);

  return (
    <div
      className={cnShell(showStickyBuy)}
    >
      <Link
        href="/menu"
        className="muted inline-flex items-center gap-2 text-sm hover:text-[var(--paper)]"
      >
        <ArrowLeft size={15} aria-hidden /> This week&apos;s table
      </Link>

      <div className="grid gap-8 md:grid-cols-2 md:gap-16">
        <div className="photo ember-glow aspect-[4/3] md:aspect-[4/5]">
          {product.imagePath ? (
            <Image
              src={product.imagePath}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 560px"
              className="relative z-[1] object-cover"
              style={productImageStyle(product)}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <span className="faint text-sm">No photo yet</span>
            </div>
          )}
        </div>

        <div className="grid content-start gap-5 md:gap-6">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="sage">{product.category}</Chip>
              {scarcity ? (
                <Chip tone="ember" dot>
                  {scarcity}
                </Chip>
              ) : null}
            </div>
            <h1 className="text-[2.35rem] leading-[1] md:text-[3.4rem]">{product.name}</h1>
            <p className="font-display text-2xl">
              {formatPesoShort(price)}
              <span className="muted ml-2 font-sans text-sm">per {product.sellingUnit}</span>
            </p>
            {product.piecesPerUnit > 1 ? (
              <p className="faint text-xs">
                {product.piecesPerUnit} pieces in every {product.sellingUnit}.
              </p>
            ) : null}
          </div>

          <p className="text-[1.02rem] leading-7">{product.description}</p>

          {/* Desktop / tablet buy block — phone uses sticky bar below. */}
          <div className="hidden gap-3 md:grid">
            {item && menu ? (
              <AddToBasket
                menuItemId={item.id}
                productName={product.name}
                soldOut={remaining !== null && remaining <= 0}
                closed={!open}
                inBasket={inBasket}
                max={remaining}
              />
            ) : (
              <Notice tone="info" title="Not on this week's table">
                {menu
                  ? `This one rotates in and out. ${menu.title} is live now, and we post the next rotation every week.`
                  : "We have not published the next rotation yet."}
              </Notice>
            )}

            {open && menu ? (
              <p className="faint text-xs leading-5">
                {menu.cutoffEnabled
                  ? `Order by ${formatDateTime(menu.cutoffAt)}.`
                  : "Orders stay open until the bakery closes them."}{" "}
                Collect {formatDay(menu.pickupDate)}.
              </p>
            ) : null}
          </div>

          {!item ? (
            <div className="md:hidden">
              <Notice tone="info" title="Not on this week's table">
                {menu
                  ? `This one rotates in and out. ${menu.title} is live now.`
                  : "We have not published the next rotation yet."}
              </Notice>
            </div>
          ) : null}

          <dl className="grid gap-4 border-t border-[var(--line)] pt-6 text-sm">
            {allergens.length > 0 ? (
              <div className="grid gap-1">
                <dt className="eyebrow">Contains</dt>
                <dd className="muted">{allergens.join(", ")}</dd>
              </div>
            ) : null}
            {product.storageNotes ? (
              <div className="grid gap-1">
                <dt className="eyebrow">Keeping it</dt>
                <dd className="muted leading-6">{product.storageNotes}</dd>
              </div>
            ) : null}
            {product.shelfLifeNotes ? (
              <div className="grid gap-1">
                <dt className="eyebrow">Eat it by</dt>
                <dd className="muted leading-6">{product.shelfLifeNotes}</dd>
              </div>
            ) : null}
            <div className="grid gap-1">
              <dt className="eyebrow">Collection</dt>
              <dd className="muted leading-6">{settings.pickupAddress}</dd>
            </div>
          </dl>
        </div>
      </div>

      {showStickyBuy && item ? (
        <MobileStickyBar>
          <div className="mx-auto grid max-w-lg gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-semibold">{product.name}</span>
              <span className="shrink-0 font-display text-lg">{formatPesoShort(price)}</span>
            </div>
            <AddToBasket
              menuItemId={item.id}
              productName={product.name}
              soldOut={remaining !== null && remaining <= 0}
              closed={!open}
              inBasket={inBasket}
              max={remaining}
            />
          </div>
        </MobileStickyBar>
      ) : null}
    </div>
  );
}

function cnShell(sticky: boolean) {
  return sticky
    ? "shell grid gap-8 py-8 pb-44 md:gap-10 md:py-16 md:pb-16"
    : "shell grid gap-8 py-8 md:gap-10 md:py-16";
}
