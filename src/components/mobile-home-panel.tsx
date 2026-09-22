import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { BakeWeek } from "@/components/bake-week";
import { BrandLogo } from "@/components/brand-marks";
import { Eyebrow } from "@/components/ui";
import { productImageStyle } from "@/lib/product-image";
import type { BakeCycle } from "@/lib/time";

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
 * Phone-only home body. Soft strips + photo tiles so featured and story
 * sit in the same honey-cocoa canvas as the hero — no floating “app cards”.
 */
export function MobileHomePanel({
  open,
  cycle,
  now,
  cutoffLabel,
  collectLabel,
  announcement,
  featured,
  itemCount,
  story,
  heroPath,
}: {
  open: boolean;
  cycle: BakeCycle;
  now: Date;
  cutoffLabel: string;
  collectLabel: string;
  announcement: string | null;
  featured: FeaturedTile[];
  itemCount: number;
  story: string;
  heroPath: string | null;
}) {
  const storyPreview =
    (story.trim().split(/\n+/).filter(Boolean)[0] ?? story).trim() ||
    "We bake in small weekly batches with less sugar, real butter, and long ferments — so every loaf is worth the wait.";

  return (
    <div className="md:hidden">
      <div className="shell grid gap-6 pb-14 pt-2">
        {/* Order window — hairline strip that continues the hero */}
        <div className="grid gap-1.5 border-y border-[var(--line)] py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p
              className={cn(
                "text-[0.65rem] font-semibold uppercase tracking-[0.16em]",
                open ? "text-[var(--ember)]" : "text-[var(--wheat)]",
              )}
            >
              {open ? "Ordering open" : "Ordering closed"}
            </p>
            <p className="muted text-[0.78rem]">
              Collect <span className="text-[var(--paper)]">{collectLabel}</span>
            </p>
          </div>
          <p className="muted text-[0.78rem] leading-5">
            {open ? (
              <>
                Closes <span className="text-[var(--paper)]">{cutoffLabel}</span>
              </>
            ) : (
              "Next rotation opens after Sunday collection."
            )}
          </p>
        </div>

        {announcement ? (
          <p className="border-l-2 border-[var(--ember)] pl-3 text-[0.85rem] leading-6 text-[var(--muted)]">
            {announcement}
          </p>
        ) : null}

        <BakeWeek
          cycle={cycle}
          now={now}
          className="gap-2 [&_li]:rounded-lg [&_li]:py-2 [&_p]:text-[0.65rem]"
        />

        <FeaturedRail products={featured} />

        {/* Story — cream band, same language as desktop */}
        <section
          aria-labelledby="mobile-story-heading"
          className="paper-section relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-5 py-9"
        >
          <div className="mx-auto grid max-w-lg gap-4">
            <BrandLogo href={null} className="h-[72px] w-auto drop-shadow-none" />
            <Eyebrow>Our story</Eyebrow>
            <h2
              id="mobile-story-heading"
              className="text-[1.85rem] leading-[1.05] text-[#3b231f]"
            >
              Bake less.
              <br />
              Bake better.
            </h2>
            <p className="text-[0.92rem] leading-7 text-[#7a5a3c]">{storyPreview}</p>
            {heroPath ? (
              <div className="relative mt-1 aspect-[16/10] overflow-hidden rounded-2xl">
                <Image
                  src={heroPath}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover object-[68%_42%]"
                />
              </div>
            ) : null}
          </div>
        </section>

        <Link
          href="/menu"
          className="flex items-center justify-between gap-3 py-1 transition-opacity active:opacity-80"
        >
          <span className="grid gap-0.5">
            <span className="font-display text-[1.35rem] leading-tight text-[var(--paper)]">
              This week&apos;s table
            </span>
            <span className="muted text-xs leading-5">
              {itemCount > 0
                ? open
                  ? `${itemCount} things baking — tap to order`
                  : `${itemCount} things on the board`
                : "See what is baking"}
            </span>
          </span>
          <span className="grid size-10 place-items-center rounded-full border border-[var(--line)] text-[var(--ember)]">
            <ArrowRight size={18} aria-hidden />
          </span>
        </Link>

        <section className="grid gap-6 pb-2">
          <div className="grid gap-2">
            <p className="eyebrow m-0">How it works</p>
            <h2 className="font-display text-[1.85rem] leading-tight">Four steps, one week</h2>
          </div>
          <ol className="grid grid-cols-2 gap-x-5 gap-y-8">
            {[
              [
                "Choose",
                `Pick from the three to five things we are baking. Ordering closes ${cutoffLabel}.`,
              ],
              [
                "Pay in full",
                "Card, GCash or QR Ph at checkout. Paying up front is how we know exactly how much flour to mix.",
              ],
              [
                "We bake",
                "Friday through Sunday, by hand, in small batches. Nothing is made before it is sold.",
              ],
              [
                "Collect",
                "Sunday at the slot you picked. Or leave a number and we will arrange a rider with you.",
              ],
            ].map(([title, body], index) => (
              <li key={title} className="grid gap-2 content-start">
                <span className="font-display text-[2.1rem] leading-none text-[var(--line-strong)]">
                  0{index + 1}
                </span>
                <h3 className="font-display text-[1.15rem] leading-tight text-[var(--paper)]">
                  {title}
                </h3>
                <p className="muted text-[0.8rem] leading-5">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function FeaturedRail({ products }: { products: FeaturedTile[] }) {
  if (products.length === 0) {
    return (
      <section className="grid gap-2">
        <p className="eyebrow m-0">Best sellers</p>
        <p className="muted text-sm leading-6">
          Mark products as Featured in admin to show favourites here.
        </p>
        <Link href="/menu" className="link-underline w-fit text-sm font-semibold">
          Browse the table
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Best sellers" className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow m-0">Best sellers</p>
          <h2 className="font-display text-[1.4rem] leading-tight">Favourites</h2>
        </div>
        <Link href="/menu" className="text-[0.7rem] font-semibold text-[var(--ember)]">
          Full menu
        </Link>
      </div>

      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-1",
          "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/bread/${product.slug}`}
            className="group w-[6.75rem] shrink-0"
            aria-label={`${product.name} — open to order`}
          >
            <span className="photo relative mb-2 block aspect-square overflow-hidden rounded-2xl">
              {product.imagePath ? (
                <Image
                  src={product.imagePath}
                  alt=""
                  fill
                  sizes="108px"
                  className="object-cover"
                  style={productImageStyle(product)}
                />
              ) : (
                <span className="grid h-full place-items-center bg-[var(--surface)] px-2 text-center text-[0.6rem] text-[var(--faint)]">
                  {product.name}
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-center text-[0.7rem] font-medium leading-snug text-[var(--muted)] group-active:text-[var(--paper)]">
              {product.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
