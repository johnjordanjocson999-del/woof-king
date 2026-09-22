import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

/*
  The logo is the die-cut sticker from the brand sheet: the pup sitting on the
  cream WOOF KING plate, white keyline around the whole mark. Nothing here is
  re-set in a typeface — the plate *is* the name. Cut by scripts/extract-sticker-logo.mjs.
*/
const LOCKUP = { src: "/brand/woof-king-lockup.png", w: 263, h: 348 };

/**
 * The logo and name, exactly as drawn on the brand sheet. Size by height
 * (`h-[84px]`); width follows the sticker. Around 84px is the floor for the
 * plate lettering staying readable.
 */
export function BrandLogo({
  className,
  href = "/",
  priority = false,
}: {
  /** Must set a height, e.g. `h-[84px]`. Width follows from the aspect ratio. */
  className?: string;
  href?: string | null;
  priority?: boolean;
}) {
  const img = (
    <Image
      src={LOCKUP.src}
      // Decorative when linked: the link carries the accessible name, so letting
      // the image name itself too would announce the brand twice.
      alt={href === null ? `${BRAND.name} logo` : ""}
      width={LOCKUP.w}
      height={LOCKUP.h}
      priority={priority}
      sizes="(max-width: 768px) 76px, 120px"
      className={cn(
        "w-auto select-none md:drop-shadow-[0_6px_16px_rgba(20,10,4,0.45)]",
        className,
      )}
    />
  );

  if (href === null) return img;
  return (
    <Link href={href} aria-label={`${BRAND.name} home`} className="inline-flex shrink-0">
      {img}
    </Link>
  );
}

/** Scalloped rim drawn symmetrically around the viewBox center. */
const SEAL_SCALLOP = (() => {
  const cx = 86;
  const cy = 86;
  const lobes = 16;
  const outerR = 80;
  const innerR = 72;
  const pts: string[] = [];
  for (let i = 0; i < lobes; i++) {
    const a0 = (Math.PI * 2 * i) / lobes - Math.PI / 2;
    const a1 = (Math.PI * 2 * (i + 0.5)) / lobes - Math.PI / 2;
    pts.push(
      `${(cx + Math.cos(a0) * outerR).toFixed(2)},${(cy + Math.sin(a0) * outerR).toFixed(2)}`,
      `${(cx + Math.cos(a1) * innerR).toFixed(2)},${(cy + Math.sin(a1) * innerR).toFixed(2)}`,
    );
  }
  return `M${pts[0]}L${pts.slice(1).join("L")}Z`;
})();

/**
 * The order code, stamped. Shown on the confirmation screen and on the order
 * page, where it doubles as the pass the customer holds up at the counter, so
 * the code has to stay legible at arm's length.
 *
 * Shape, ring, and type all share the same center (86, 86) so nothing drifts.
 */
export function WaxSeal({
  code,
  caption,
  paid = false,
  className,
}: {
  code: string;
  caption?: string;
  /** When false, the rim says the order is still awaiting payment. */
  paid?: boolean;
  className?: string;
}) {
  const status = paid ? "Paid in full" : "Awaiting payment";
  const gradientId = "seal-wax-fill";

  return (
    <div className={cn("grid justify-items-center gap-3", className)}>
      <div className="relative h-[172px] w-[172px]">
        <svg
          viewBox="0 0 172 172"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <radialGradient id={gradientId} cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="var(--ember-glow)" />
              <stop offset="55%" stopColor="var(--ember)" />
              <stop offset="100%" stopColor="var(--ember-deep)" />
            </radialGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d={SEAL_SCALLOP} />
          <circle
            cx="86"
            cy="86"
            r="54"
            fill="none"
            stroke="#2a1407"
            strokeWidth="1.4"
            opacity="0.4"
          />
        </svg>

        {/* HTML stack is flex-centered on the same mid-point as the SVG ring. */}
        <div
          className="absolute inset-0 grid place-items-center"
          aria-label={`${BRAND.name} order ${code}, ${status}`}
        >
          <div className="grid w-[6.75rem] justify-items-center gap-1 text-center text-[#2a1407]">
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] opacity-70">
              {BRAND.name}
            </span>
            <span className="font-display text-[1.15rem] leading-none tracking-tight sm:text-[1.2rem]">
              {code}
            </span>
            <span
              className={cn(
                "font-semibold uppercase opacity-70",
                paid
                  ? "text-[0.58rem] tracking-[0.14em]"
                  : "text-[0.55rem] tracking-[0.06em]",
              )}
            >
              {status}
            </span>
          </div>
        </div>
      </div>
      {caption ? <p className="muted max-w-xs text-center text-xs">{caption}</p> : null}
    </div>
  );
}
