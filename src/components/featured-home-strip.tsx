import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { productImageStyle } from "@/lib/product-image";

type FeaturedTile = {
  id: string;
  slug: string;
  name: string;
  imagePath: string | null;
  focalX: number;
  focalY: number;
  imageZoom: number;
};

/**
 * Compact best-seller strip for the phone home only.
 * Image tiles only — tap opens the product on the Menu tab so they can order.
 */
export function FeaturedHomeStrip({ products }: { products: FeaturedTile[] }) {
  if (products.length === 0) {
    return (
      <section className="shell grid gap-3 py-5 md:hidden">
        <p className="eyebrow">Best sellers</p>
        <p className="muted text-sm leading-6">
          Favourites will show here once they are marked Featured in admin.
        </p>
        <Link href="/menu" className="btn btn-primary btn-sm w-fit">
          Browse the table
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Best sellers" className="grid gap-2.5 py-4 md:hidden">
      <div className="shell flex items-baseline justify-between gap-3">
        <p className="eyebrow m-0">Best sellers</p>
        <Link
          href="/menu"
          className="text-[0.7rem] font-semibold tracking-wide text-[var(--ember)]"
        >
          Full menu
        </Link>
      </div>

      <div
        className={cn(
          "flex gap-2.5 overflow-x-auto px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          "scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "mask-[linear-gradient(90deg,transparent,black_12px,black_calc(100%-20px),transparent)]",
        )}
      >
        {products.map((product, index) => (
          <Link
            key={product.id}
            href={`/bread/${product.slug}`}
            className="group relative shrink-0"
            style={{ animationDelay: `${index * 40}ms` }}
            aria-label={`${product.name} — open to order`}
          >
            <span
              className={cn(
                "relative block size-[4.25rem] overflow-hidden rounded-[1.15rem]",
                "border border-[color-mix(in_oklab,var(--ember)_28%,var(--line))]",
                "bg-[var(--surface-2)] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.75)]",
                "ring-1 ring-[color-mix(in_oklab,var(--paper)_8%,transparent)]",
                "transition-[transform,box-shadow] duration-200",
                "group-active:scale-[0.94] group-active:shadow-none",
              )}
            >
              {product.imagePath ? (
                <Image
                  src={product.imagePath}
                  alt=""
                  fill
                  sizes="68px"
                  className="object-cover transition-transform duration-300 group-active:scale-105"
                  style={productImageStyle(product)}
                />
              ) : (
                <span className="grid h-full place-items-center px-1 text-center text-[0.5rem] leading-tight text-[var(--faint)]">
                  {product.name}
                </span>
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--ink)_45%,transparent)] to-transparent opacity-80"
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
