/**
 * The one file to edit when the brand changes.
 *
 * `palette` is injected as CSS custom properties on <html> by the root layout,
 * so changing a hex here recolours the entire site without touching a
 * component. Copy text that the owner edits day to day lives in Settings in the
 * database instead; these are the defaults and the fixed identity.
 */

export const BRAND = {
  /**
   * Sentence case for prose, metadata and aria labels. The displayed wordmark is
   * not set from this: it is part of the logo artwork in public/brand.
   */
  name: "Woof King",
  shortName: "Woof King",
  tagline: "Good bread, happier people.",
  description:
    "A small Manila bakehouse where healthy meets delicious. A short menu of breads and pastries, baked once a week. Order Mon–Thu, collect or get delivery on the weekend.",
} as const;

/**
 * Honey-Cocoa.
 *
 * Pulled straight off the logo so the crowned pup sits on the page rather than
 * on top of it: the deep cocoa of his outline becomes the canvas, his crown
 * becomes the light source, and the wordmark plate becomes the text colour.
 * Nothing here is near-black, because the mascot's own darkest brown is #3B231F
 * and a black page would have made him look like a sticker on a void.
 */
export const palette = {
  /** Page canvas. Deep cocoa, a shade under the mascot's outline brown. */
  ink: "#20140A",
  /** Raised surfaces: cards, drawers, the sticky basket. */
  surface: "#2E1D0F",
  /** A step above surface, for inputs and hovered rows. */
  surface2: "#3C2714",
  /** Primary text on ink. The butter cream of the wordmark plate. */
  paper: "#FDF2D8",
  /** The single bright section, where the story is told. */
  paperSolid: "#FBEFCD",
  /** Secondary text. */
  muted: "#CBAA7C",
  /** Tertiary text and disabled states. */
  faint: "#94724C",

  /** The light source: the crown. Used for CTAs, the ring, today's marker. */
  ember: "#FFC209",
  emberGlow: "#FFD75E",
  emberDeep: "#C98A00",
  /** Text that sits on top of `ember`. The wordmark's own chocolate. */
  onEmber: "#3B231F",

  crust: "#A3612C",
  wheat: "#F0DCA4",
  sage: "#7E8A5F",
  /** The mixing bowl, for informational accents. */
  bowl: "#3E86B5",

  /** The scarf. */
  danger: "#E2503C",
  success: "#7FA05C",

  /** Hairlines instead of heavy borders, so the dark UI stays quiet. */
  line: "rgba(253, 242, 216, 0.13)",
  lineStrong: "rgba(253, 242, 216, 0.24)",
} as const;

export const radius = {
  sm: "10px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  pill: "999px",
} as const;

/** Rendered into a `style` attribute on <html> by the root layout. */
export function paletteCssVars(): Record<string, string> {
  return {
    "--ink": palette.ink,
    "--surface": palette.surface,
    "--surface-2": palette.surface2,
    "--paper": palette.paper,
    "--paper-solid": palette.paperSolid,
    "--muted": palette.muted,
    "--faint": palette.faint,
    "--ember": palette.ember,
    "--ember-glow": palette.emberGlow,
    "--ember-deep": palette.emberDeep,
    "--on-ember": palette.onEmber,
    "--crust": palette.crust,
    "--wheat": palette.wheat,
    "--sage": palette.sage,
    "--bowl": palette.bowl,
    "--danger": palette.danger,
    "--success": palette.success,
    "--line": palette.line,
    "--line-strong": palette.lineStrong,
    "--radius-sm": radius.sm,
    "--radius-md": radius.md,
    "--radius-lg": radius.lg,
    "--radius-xl": radius.xl,
  };
}

export const ALLERGEN_OPTIONS = [
  "gluten",
  "wheat",
  "dairy",
  "eggs",
  "nuts",
  "peanuts",
  "soy",
  "sesame",
] as const;

export const CATEGORY_OPTIONS = [
  { id: "bread", label: "Bread" },
  { id: "pastry", label: "Pastry" },
  { id: "cake", label: "Cake" },
  { id: "drink", label: "Drink" },
] as const;
