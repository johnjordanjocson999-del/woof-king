import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPesoShort } from "@/lib/money";
import { AddToBasket } from "@/components/cart-controls";
import { Chip } from "@/components/ui";
import { productImageStyle } from "@/lib/product-image";
import type { MenuItemWithProduct } from "@/domain/menu";
import { remainingFor, scarcityLabel } from "@/domain/menu";

/**
 * Weekly menu listing card — numbered editorial piece, not a shop tile.
 *
 * On phones: shorter crop + clear price/add row so the whole week stacks
 * vertically and you can scan without sideways swiping.
 */
export function ProductCard({
  item,
  index,
  inBasket,
  closed,
  revealDelay = 0,
  className,
}: {
  item: MenuItemWithProduct;
  index: number;
  inBasket: number;
  closed: boolean;
  revealDelay?: number;
  className?: string;
}) {
  const { product } = item;
  const remaining = remainingFor(item);
  const scarcity = scarcityLabel(item);
  const soldOut = remaining !== null && remaining <= 0;
  const allergens = product.allergens.split(",").filter(Boolean);

  return (
    <article
      className={cn(
        "menu-product-card reveal group grid content-start gap-3 md:gap-4",
        className,
      )}
      data-reveal-delay={revealDelay}
    >
      <Link
        href={`/bread/${product.slug}`}
        className="grid gap-3 focus-visible:outline-none md:gap-4"
        aria-label={`${product.name}, ${formatPesoShort(item.priceCentavos)} per ${product.sellingUnit}`}
      >
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[2.1rem] leading-none text-[var(--line-strong)] tnum md:text-[2.6rem]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span aria-hidden className="mb-1.5 h-px flex-1 bg-[var(--line)] md:mb-2" />
          {scarcity ? (
            <Chip tone={soldOut ? "danger" : "ember"} dot className="mb-1">
              {scarcity}
            </Chip>
          ) : null}
        </div>

        {/*
          Phone: 4/3 keeps add-to-basket in view sooner.
          Desktop: tall 4/5 editorial crop.
        */}
        <div className="photo photo-zoom ember-glow aspect-[4/3] md:aspect-[4/5]">
          {product.imagePath ? (
            <Image
              src={product.imagePath}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 48vw, 360px"
              className={cn("relative z-[1]", soldOut && "opacity-45")}
              style={productImageStyle(product)}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <span className="faint text-xs">No photo yet</span>
            </div>
          )}
        </div>

        <div className="grid gap-1.5 md:gap-2">
          <h3 className="text-[1.35rem] leading-tight group-hover:text-[var(--ember-glow)] md:text-[1.5rem]">
            {product.name}
          </h3>
          <p className="muted line-clamp-2 text-sm leading-6">{product.description}</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-xl">
          {formatPesoShort(item.priceCentavos)}
          <span className="muted ml-1.5 font-sans text-xs">per {product.sellingUnit}</span>
        </span>
        {allergens.length > 0 ? (
          <span className="faint max-w-[50%] truncate text-[0.68rem] uppercase tracking-[0.1em]">
            {allergens.join(" · ")}
          </span>
        ) : null}
      </div>

      <AddToBasket
        menuItemId={item.id}
        productName={product.name}
        soldOut={soldOut}
        closed={closed}
        inBasket={inBasket}
        max={remaining}
      />
    </article>
  );
}
