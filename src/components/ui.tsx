import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPeso, formatPesoShort, type Centavos } from "@/lib/money";

/* ------------------------------------------------------------------ buttons */

type Variant = "primary" | "ghost" | "solid" | "danger";

export function btn(variant: Variant = "primary", extra?: string, small = false): string {
  return cn("btn", `btn-${variant}`, small && "btn-sm", extra);
}

export function ButtonLink({
  href,
  variant = "primary",
  small,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  small?: boolean;
} & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={btn(variant, className, small)} {...rest}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ surfaces */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

/**
 * Every section on the site opens the same way: a hairline, an ember eyebrow, a
 * large serif title, and an optional action on the right. Repeating one shape
 * is what makes the page scan as a single piece rather than stacked widgets.
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      <hr className="hairline" />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-2">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2 className="text-[2rem] leading-[1.03] md:text-[2.75rem]">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? <p className="muted max-w-2xl text-[0.98rem]">{description}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- chips */

export function Chip({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: "neutral" | "ember" | "sage" | "danger";
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "chip",
        tone === "ember" && "chip-ember",
        tone === "sage" && "chip-sage",
        tone === "danger" && "chip-danger",
        dot && "chip-dot",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------- money */

export function Money({
  value,
  short,
  className,
}: {
  value: Centavos;
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("price", className)}>
      {short ? formatPesoShort(value) : formatPeso(value)}
    </span>
  );
}

/* -------------------------------------------------------------------- notices */

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const border = {
    info: "border-l-[var(--ember)]",
    warn: "border-l-[var(--wheat)]",
    danger: "border-l-[var(--danger)]",
    success: "border-l-[var(--success)]",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--line)] border-l-2 bg-[var(--surface)] px-4 py-3 text-sm leading-6",
        border,
        className,
      )}
      role={tone === "danger" ? "alert" : undefined}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "muted mt-1")}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children ? <p className="muted max-w-md text-sm">{children}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 content-start", className)}>
      <span className="flex min-h-[1.25rem] items-baseline gap-2 text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden className="text-[var(--ember)]">
            *
          </span>
        ) : (
          <span className="faint text-xs font-normal">optional</span>
        )}
      </span>
      {children}
      {hint ? <span className="faint text-xs font-normal leading-5">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

/**
 * A big tappable radio. Used for pickup vs delivery, time slots and payment
 * method. Selected state lives in CSS via :has(), so these work server-rendered.
 */
export function ChoiceCard({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  disabled,
  title,
  meta,
  children,
  className,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  /** Controlled mode — keeps selection after a failed submit. */
  checked?: boolean;
  onChange?: () => void;
  disabled?: boolean;
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("choice flex h-full flex-col", className)}>
      <input
        type="radio"
        name={name}
        value={value}
        {...(checked !== undefined
          ? { checked, onChange: onChange ?? (() => {}) }
          : { defaultChecked })}
        disabled={disabled}
      />
      <span className="flex items-start justify-between gap-3">
        <span className="grid gap-1">
          <span className="font-display text-lg leading-tight">{title}</span>
          {children ? (
            <span className="muted text-xs font-normal leading-5">{children}</span>
          ) : null}
        </span>
        {meta ? <span className="shrink-0 text-right text-xs font-semibold">{meta}</span> : null}
      </span>
    </label>
  );
}
