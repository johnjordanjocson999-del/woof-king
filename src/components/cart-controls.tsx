"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Minus, Plus, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { addToBasket, removeFromBasket, setBasketQuantity } from "@/app/actions/cart";

/**
 * Basket controls.
 *
 * Both pieces update on screen the instant they are tapped and reconcile with
 * the server afterwards. Baymard's cart research is specific about this: use
 * buttons rather than a dropdown, let minus reach zero to remove, refresh the
 * total immediately, and offer an undo. All four are implemented here.
 */

/* ------------------------------------------------------------------ stepper */

export function CartStepper({
  menuItemId,
  quantity,
  max,
  className,
}: {
  menuItemId: string;
  quantity: number;
  /** null means the owner set no weekly cap. */
  max: number | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(quantity);
  const [note, setNote] = useState<string | null>(null);

  const atMax = max !== null && optimistic >= max;

  function change(next: number) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await setBasketQuantity(menuItemId, next);
      setNote(result.message ?? null);
    });
  }

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="stepper" aria-busy={pending}>
        <button
          type="button"
          onClick={() => change(optimistic - 1)}
          aria-label={optimistic === 1 ? "Remove from basket" : "Reduce quantity"}
        >
          {optimistic === 1 ? <Trash2 size={15} aria-hidden /> : <Minus size={16} aria-hidden />}
        </button>
        <output className="qty" aria-label={`Quantity ${optimistic}`}>
          {optimistic}
        </output>
        <button
          type="button"
          onClick={() => change(optimistic + 1)}
          disabled={atMax}
          aria-label="Increase quantity"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {note ? (
        <span className="text-[0.7rem] leading-4 text-[var(--wheat)]">{note}</span>
      ) : atMax ? (
        <span className="faint text-[0.7rem] leading-4">All {max} remaining are yours</span>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- add button */

export function AddToBasket({
  menuItemId,
  productName,
  soldOut,
  closed,
  inBasket,
  max,
  className,
}: {
  menuItemId: string;
  productName: string;
  soldOut?: boolean;
  closed?: boolean;
  inBasket: number;
  max: number | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (closed) {
    return (
      <button type="button" className={cn("btn btn-ghost w-full", className)} disabled>
        Orders closed
      </button>
    );
  }

  if (soldOut) {
    return (
      <button type="button" className={cn("btn btn-ghost w-full", className)} disabled>
        Sold out this week
      </button>
    );
  }

  // Once something is in the basket the button is replaced by the stepper, which
  // saves a trip to the basket page just to change a quantity.
  if (inBasket > 0) {
    return <CartStepper menuItemId={menuItemId} quantity={inBasket} max={max} className={className} />;
  }

  function add() {
    startTransition(async () => {
      const outcome = await addToBasket(menuItemId, 1);
      setResult(outcome);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setResult(null), 3200);
    });
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="btn btn-primary w-full"
        aria-label={`Add ${productName} to basket`}
      >
        {result?.ok ? (
          <>
            <Check size={16} aria-hidden /> Added
          </>
        ) : (
          <>{pending ? "Adding..." : "Add to basket"}</>
        )}
      </button>
      {result?.message && !result.ok ? (
        <span role="alert" className="text-[0.72rem] leading-4 text-[var(--danger)]">
          {result.message}
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- remove/undo */

export function RemoveLine({
  menuItemId,
  quantity,
  label,
}: {
  menuItemId: string;
  quantity: number;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="muted">{label} removed.</span>
        <button
          type="button"
          className="link-underline font-semibold"
          onClick={() =>
            startTransition(async () => {
              // Undo restores the exact quantity, not a quantity of one.
              await setBasketQuantity(menuItemId, quantity);
              setRemoved(false);
            })
          }
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className="faint inline-flex items-center gap-1.5 text-xs hover:text-[var(--danger)]"
      onClick={() =>
        startTransition(async () => {
          await removeFromBasket(menuItemId);
          setRemoved(true);
        })
      }
    >
      <Trash2 size={13} aria-hidden /> Remove
    </button>
  );
}
