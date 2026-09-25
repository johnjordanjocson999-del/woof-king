"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { placeOrder, type CheckoutState, type CheckoutValues } from "@/app/actions/checkout";
import { ChoiceCard, Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { SavedPlacesPicker } from "@/components/saved-places-picker";
import { CheckoutAvailabilityPicker } from "@/components/checkout-availability-picker";
import { formatPeso } from "@/lib/money";
import type { CheckoutPaymentOption } from "@/domain/payment-options";
import type { SavedAddress } from "@/lib/saved-addresses";
import type { AvailabilitySlotView } from "@/domain/availability-types";
import { openDateKeys, slotsForDate } from "@/domain/availability-helpers";

export function CheckoutForm({
  availabilitySlots,
  paymentOptions,
  deliveryNote,
  basketTotalCentavos,
  deliveryFeeCentavos,
  loyaltyDiscountCentavos = 0,
  loyaltyLabels = [],
  defaultName,
  defaultPhone,
  defaultEmail,
  savedAddresses = [],
  defaultDeliveryAddress = "",
  defaultDeliveryInstructions = "",
}: {
  availabilitySlots: AvailabilitySlotView[];
  paymentOptions: CheckoutPaymentOption[];
  deliveryNote: string;
  basketTotalCentavos: number;
  deliveryFeeCentavos: number;
  loyaltyDiscountCentavos?: number;
  loyaltyLabels?: string[];
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  savedAddresses?: SavedAddress[];
  defaultDeliveryAddress?: string;
  defaultDeliveryInstructions?: string;
}) {
  const [state, action] = useActionState(placeOrder, { ok: false } as CheckoutState);
  const [places, setPlaces] = useState<SavedAddress[]>(savedAddresses);
  const [saveAddress, setSaveAddress] = useState(true);
  const [favoriteAddress, setFavoriteAddress] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");

  useEffect(() => {
    setPlaces(savedAddresses);
  }, [savedAddresses]);

  const [values, setValues] = useState<CheckoutValues>(() => ({
    contactName: defaultName ?? "",
    contactPhone: defaultPhone ?? "",
    contactEmail: defaultEmail ?? "",
    notes: "",
    fulfillment: "pickup",
    availabilitySlotId: "",
    deliveryAddress: defaultDeliveryAddress,
    deliveryInstructions: defaultDeliveryInstructions,
    paymentMethod: paymentOptions[0]?.slug ?? "",
  }));

  useEffect(() => {
    if (state.values) {
      setValues(state.values);
      setSelectedSlotId(state.values.availabilitySlotId);
    }
  }, [state]);

  function patch<K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const fulfillment = values.fulfillment;
  const filteredSlots = useMemo(
    () =>
      availabilitySlots.filter(
        (s) => s.active && (s.kind === "both" || s.kind === fulfillment),
      ),
    [availabilitySlots, fulfillment],
  );

  // Keep date/time valid when fulfillment or open slots change, and when the customer picks a new day.
  useEffect(() => {
    const dates = openDateKeys(filteredSlots);
    const nextDate = dates.includes(selectedDateKey) ? selectedDateKey : dates[0] ?? "";
    if (nextDate !== selectedDateKey) setSelectedDateKey(nextDate);
    const times = nextDate ? slotsForDate(filteredSlots, nextDate) : [];
    const nextSlot = times.some((t) => t.id === selectedSlotId)
      ? selectedSlotId
      : times[0]?.id ?? "";
    if (nextSlot !== selectedSlotId) {
      setSelectedSlotId(nextSlot);
      patch("availabilitySlotId", nextSlot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, filteredSlots, selectedDateKey]);

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

  useEffect(() => {
    if (visibleMethods.length === 0) return;
    if (!visibleMethods.some((m) => m.slug === values.paymentMethod)) {
      patch("paymentMethod", visibleMethods[0].slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when method list changes
  }, [visibleMethods, values.paymentMethod]);

  const selectedIsFavorite = places.some(
    (p) =>
      p.favorite &&
      p.address.trim().toLowerCase() === values.deliveryAddress.trim().toLowerCase(),
  );

  return (
    <form action={action} className="grid gap-10">
      {state.message ? (
        <Notice tone="danger" title="Could not place order">
          {state.message} Your details are still here — fix what is wrong and try again.
        </Notice>
      ) : null}

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Your details</legend>
        <div className="grid items-start gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
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
                Free. Collect on a day the bakery marked free.
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
                Flat {formatPeso(deliveryFeeCentavos)} · on free calendar days only.
              </span>
            </span>
          </label>
        </div>

        {fulfillment === "delivery" ? (
          <Notice tone="info" title={`Delivery fee ${formatPeso(deliveryFeeCentavos)}`}>
            {deliveryNote}
          </Notice>
        ) : null}

        <CheckoutAvailabilityPicker
          fulfillment={fulfillment}
          slots={filteredSlots}
          selectedDateKey={selectedDateKey}
          selectedSlotId={selectedSlotId}
          error={state.fieldErrors?.availabilitySlotId}
          onSelectDate={setSelectedDateKey}
          onSelectSlot={(id) => {
            setSelectedSlotId(id);
            patch("availabilitySlotId", id);
          }}
        />

        {fulfillment === "delivery" ? (
          <div className="grid gap-4">
            <SavedPlacesPicker
              places={places}
              selectedAddress={values.deliveryAddress}
              onPlacesChange={setPlaces}
              onPick={(place) => {
                patch("deliveryAddress", place.address);
                patch("deliveryInstructions", place.instructions);
                setFavoriteAddress(place.favorite);
                setSaveAddress(true);
              }}
            />

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

            <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <label className="flex items-start gap-2.5 text-sm leading-5">
                <input
                  type="checkbox"
                  name="saveAddress"
                  value="1"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-[var(--paper)]">Save this address</span>
                  <span className="muted block text-xs leading-4">
                    Keep it in your recent places so you don’t type it again next week.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm leading-5">
                <input
                  type="checkbox"
                  name="favoriteAddress"
                  value="1"
                  checked={favoriteAddress || selectedIsFavorite}
                  onChange={(e) => setFavoriteAddress(e.target.checked)}
                  className="mt-1"
                />
                <span className="flex items-start gap-1.5">
                  <Star
                    size={14}
                    className={
                      favoriteAddress || selectedIsFavorite
                        ? "mt-0.5 shrink-0 fill-[var(--ember)] text-[var(--ember)]"
                        : "mt-0.5 shrink-0 text-[var(--faint)]"
                    }
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold text-[var(--paper)]">Mark as favorite</span>
                    <span className="muted block text-xs leading-4">
                      Pin it to the top of your places for one-tap reuse.
                    </span>
                  </span>
                </span>
              </label>
              {!saveAddress ? <input type="hidden" name="saveAddress" value="0" /> : null}
            </div>
          </div>
        ) : null}
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
