"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { placeOrder, type CheckoutState, type CheckoutValues } from "@/app/actions/checkout";
import { ChoiceCard, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatClock } from "@/lib/time";
import { formatPeso } from "@/lib/money";
import type { CheckoutPaymentOption } from "@/domain/payment-options";

interface Slot {
  id: string;
  label: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
}

interface DeliveryWindowOption {
  id: string;
  label: string;
  dateIso: string;
  dateLabel: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
}

function firstOpenSlotId(slots: Slot[]) {
  return slots.find((slot) => slot.booked < slot.capacity)?.id ?? "";
}

function firstOpenWindowId(windows: DeliveryWindowOption[]) {
  return windows.find((window) => window.booked < window.capacity)?.id ?? "";
}

export function CheckoutForm({
  slots,
  deliveryWindows,
  paymentOptions,
  deliveryNote,
  basketTotalCentavos,
  deliveryFeeCentavos,
  loyaltyDiscountCentavos = 0,
  loyaltyLabels = [],
  defaultName,
  defaultPhone,
  defaultEmail,
}: {
  slots: Slot[];
  deliveryWindows: DeliveryWindowOption[];
  paymentOptions: CheckoutPaymentOption[];
  deliveryNote: string;
  basketTotalCentavos: number;
  deliveryFeeCentavos: number;
  loyaltyDiscountCentavos?: number;
  loyaltyLabels?: string[];
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
}) {
  const [state, action] = useActionState(placeOrder, { ok: false } as CheckoutState);

  const [values, setValues] = useState<CheckoutValues>(() => ({
    contactName: defaultName ?? "",
    contactPhone: defaultPhone ?? "",
    contactEmail: defaultEmail ?? "",
    notes: "",
    fulfillment: "pickup",
    pickupSlotId: firstOpenSlotId(slots),
    deliveryWindowId: firstOpenWindowId(deliveryWindows),
    deliveryAddress: "",
    deliveryInstructions: "",
    paymentMethod: paymentOptions[0]?.slug ?? "",
  }));

  // After a failed submit, restore exactly what they typed — do not wipe the form.
  useEffect(() => {
    if (state.values) setValues(state.values);
  }, [state]);

  function patch<K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const fulfillment = values.fulfillment;
  const openWindows = deliveryWindows.filter((w) => w.booked < w.capacity);
  const deliveryFee = fulfillment === "delivery" ? deliveryFeeCentavos : 0;
  const grandTotal = basketTotalCentavos + deliveryFee;

  const visibleMethods = useMemo(
    () =>
      paymentOptions.filter((opt) => {
        if (fulfillment === "delivery" && (opt.pickupOnly || opt.type === "cash")) {
          return false;
        }
        return true;
      }),
    [paymentOptions, fulfillment],
  );

  // If the chosen method disappears (e.g. cash on delivery), fall back to the first visible one.
  useEffect(() => {
    if (visibleMethods.length === 0) return;
    if (!visibleMethods.some((m) => m.slug === values.paymentMethod)) {
      patch("paymentMethod", visibleMethods[0].slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when method list changes
  }, [visibleMethods, values.paymentMethod]);

  return (
    <form action={action} className="grid gap-10">
      {state.message ? (
        <Notice tone="danger" title="Could not place order">
          {state.message} Your details are still here — fix what is wrong and try again.
        </Notice>
      ) : null}

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Your details</legend>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={state.fieldErrors?.contactName}>
            <input
              name="contactName"
              required
              autoComplete="name"
              value={values.contactName}
              onChange={(e) => patch("contactName", e.target.value)}
              placeholder="Maria Santos"
            />
          </Field>
          <Field
            label="Phone"
            required
            hint="We will only use this for your order and delivery coordination."
            error={state.fieldErrors?.contactPhone}
          >
            <input
              name="contactPhone"
              required
              type="tel"
              autoComplete="tel"
              value={values.contactPhone}
              onChange={(e) => patch("contactPhone", e.target.value)}
              placeholder="09XX XXX XXXX"
            />
          </Field>
          <Field label="Email" className="sm:col-span-2" error={state.fieldErrors?.contactEmail}>
            <input
              name="contactEmail"
              type="email"
              autoComplete="email"
              value={values.contactEmail}
              onChange={(e) => patch("contactEmail", e.target.value)}
              placeholder="you@email.com"
            />
          </Field>
          <Field label="Notes for the bakery" className="sm:col-span-2">
            <textarea
              name="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => patch("notes", e.target.value)}
              placeholder="e.g. please bake the sourdough as dark as you dare"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Pickup or delivery</legend>
        <div className="grid items-stretch gap-3 sm:grid-cols-2">
          <label className="choice h-full">
            <input
              type="radio"
              name="fulfillment"
              value="pickup"
              checked={fulfillment === "pickup"}
              onChange={() => patch("fulfillment", "pickup")}
            />
            <span className="grid gap-1">
              <span className="font-display text-lg">Pickup</span>
              <span className="muted text-xs font-normal">
                Free. Bring your order code on Sunday.
              </span>
            </span>
          </label>
          <label className="choice h-full">
            <input
              type="radio"
              name="fulfillment"
              value="delivery"
              checked={fulfillment === "delivery"}
              onChange={() => patch("fulfillment", "delivery")}
            />
            <span className="grid gap-1">
              <span className="font-display text-lg">Delivery</span>
              <span className="muted text-xs font-normal">
                Flat {formatPeso(deliveryFeeCentavos)} added to your total.
              </span>
            </span>
          </label>
        </div>

        {fulfillment === "pickup" ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold">Sunday collection slot</p>
            {state.fieldErrors?.pickupSlotId ? (
              <p className="field-error">{state.fieldErrors.pickupSlotId}</p>
            ) : null}
            <div className="grid items-stretch gap-2 sm:grid-cols-2">
              {slots.map((slot) => {
                const full = slot.booked >= slot.capacity;
                const left = Math.max(0, slot.capacity - slot.booked);
                return (
                  <ChoiceCard
                    key={slot.id}
                    name="pickupSlotId"
                    value={slot.id}
                    checked={!full && values.pickupSlotId === slot.id}
                    onChange={() => patch("pickupSlotId", slot.id)}
                    disabled={full}
                    title={slot.label}
                    meta={full ? "Full" : `${left} left`}
                  >
                    {formatClock(slot.start)} – {formatClock(slot.end)}
                  </ChoiceCard>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <Notice tone="info" title={`Delivery fee ${formatPeso(deliveryFeeCentavos)}`}>
              {deliveryNote}
            </Notice>

            <div className="grid gap-3">
              <p className="text-sm font-semibold">Available delivery date &amp; time</p>
              {state.fieldErrors?.deliveryWindowId ? (
                <p className="field-error">{state.fieldErrors.deliveryWindowId}</p>
              ) : null}
              {openWindows.length === 0 ? (
                <Notice tone="warn" title="No delivery windows open">
                  The bakery has not posted available delivery times for this week yet. Choose
                  pickup, or message them after ordering if they open a window later.
                </Notice>
              ) : (
                <div className="grid items-stretch gap-2 sm:grid-cols-2">
                  {deliveryWindows.map((window) => {
                    const full = window.booked >= window.capacity;
                    const left = Math.max(0, window.capacity - window.booked);
                    return (
                      <ChoiceCard
                        key={window.id}
                        name="deliveryWindowId"
                        value={window.id}
                        checked={!full && values.deliveryWindowId === window.id}
                        onChange={() => patch("deliveryWindowId", window.id)}
                        disabled={full}
                        title={window.label}
                        meta={full ? "Full" : `${left} left`}
                      >
                        {window.dateLabel}
                        <br />
                        {formatClock(window.start)} – {formatClock(window.end)}
                      </ChoiceCard>
                    );
                  })}
                </div>
              )}
            </div>

            <Field label="Delivery address" required error={state.fieldErrors?.deliveryAddress}>
              <textarea
                name="deliveryAddress"
                required={fulfillment === "delivery"}
                rows={3}
                value={values.deliveryAddress}
                onChange={(e) => patch("deliveryAddress", e.target.value)}
                placeholder="House / unit, street, barangay, city — e.g. Masin Norte, Candelaria, Quezon"
              />
            </Field>
            <Field label="Delivery notes">
              <input
                name="deliveryInstructions"
                value={values.deliveryInstructions}
                onChange={(e) => patch("deliveryInstructions", e.target.value)}
                placeholder="Landmarks, gate codes, rider app preference"
              />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Pay in full</legend>
        <p className="muted text-sm leading-6">
          Choose how you want to pay. Cash is available for pickup only. Online transfers need your
          order code as the reference.
        </p>
        {state.fieldErrors?.paymentMethod ? (
          <p className="field-error">{state.fieldErrors.paymentMethod}</p>
        ) : null}
        {visibleMethods.length === 0 ? (
          <Notice tone="warn" title="No payment methods">
            The bakery has not enabled any payment options for this fulfillment yet.
          </Notice>
        ) : (
          <div className="grid items-stretch gap-2 sm:grid-cols-2">
            {visibleMethods.map((method) => (
              <ChoiceCard
                key={method.slug}
                name="paymentMethod"
                value={method.slug}
                checked={values.paymentMethod === method.slug}
                onChange={() => patch("paymentMethod", method.slug)}
                className="h-full"
                title={method.name}
              >
                {method.body}
              </ChoiceCard>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 border-t border-[var(--line)] pt-4">
        {loyaltyDiscountCentavos > 0 ? (
          <div className="grid gap-1 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="muted">Member savings</span>
              <span className="price text-[var(--success)]">
                −{formatPeso(loyaltyDiscountCentavos)}
              </span>
            </div>
            {loyaltyLabels.length > 0 ? (
              <p className="muted text-[0.7rem] leading-4">{loyaltyLabels.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
        {fulfillment === "delivery" ? (
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="muted">Delivery</span>
            <span className="price">{formatPeso(deliveryFee)}</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-lg">Total due now</span>
          <span className="font-display price text-2xl">{formatPeso(grandTotal)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Placing order..." disabled={visibleMethods.length === 0}>
            Place order — pay on next screen
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
