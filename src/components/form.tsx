"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A submit button that knows its own form is in flight.
 *
 * Every mutation in this app is a server action inside a plain <form>, so a
 * single component covers the whole admin and checkout surface. Disabling on
 * submit is what stops a double-tap from creating two orders or deducting stock
 * twice.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  small,
  className,
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "solid" | "danger";
  small?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={cn("btn", `btn-${variant}`, small && "btn-sm", className)}
      {...rest}
    >
      {pending ? (
        <>
          <Loader2 size={15} className="animate-spin" aria-hidden />
          {pendingLabel ?? "Working..."}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Confirms before submitting. Used for deletes and for voiding a POS sale. */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  small = true,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  message: string;
  variant?: "primary" | "ghost" | "solid" | "danger";
  small?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = pending || disabled;

  return (
    <button
      type="submit"
      disabled={busy}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={cn("btn", `btn-${variant}`, small && "btn-sm", className)}
    >
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : children}
    </button>
  );
}
