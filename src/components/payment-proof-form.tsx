"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitPaymentProof } from "@/app/actions/payments";
import { SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";

export function PaymentProofForm({
  orderId,
  accessToken,
  channel,
  orderCode,
  disabled,
  submitted,
}: {
  orderId: string;
  accessToken: string;
  channel: string;
  orderCode: string;
  disabled?: boolean;
  submitted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");

  return (
    <form
      className="grid gap-4 border-t border-[var(--line)] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await submitPaymentProof(orderId, accessToken, formData);
          setOk(result.ok);
          setMessage(result.message);
          if (result.ok) {
            router.push(
              `/order/${orderCode}/status?token=${encodeURIComponent(accessToken)}&justSubmitted=1`,
            );
            return;
          }
          const proof = form.querySelector<HTMLInputElement>('input[name="proof"]');
          if (proof) proof.value = "";
        });
      }}
    >
      <p className="text-sm font-semibold">Confirm you have paid</p>
      <Field
        label="Reference number"
        hint="The transaction ID from your bank or e-wallet app"
        required
      >
        <input
          name="referenceNumber"
          required
          disabled={pending || ok || disabled}
          placeholder="e.g. 2026092212345678"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />
      </Field>
      <Field label="Screenshot (optional)" hint="Upload if your app shows a receipt">
        <input name="proof" type="file" accept="image/*" disabled={pending || ok || disabled} />
      </Field>
      <input type="hidden" name="channel" value={channel} />
      <SubmitButton disabled={ok || disabled} pendingLabel="Sending...">
        {ok || submitted ? "Payment details sent" : "I have paid — submit for confirmation"}
      </SubmitButton>
      {message ? (
        <p className={`text-xs ${ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {ok
            ? message
            : `${message} Your reference is still filled in — fix and submit again.`}
        </p>
      ) : submitted ? (
        <p className="text-xs text-[var(--wheat)]">
          Waiting for the bakery to confirm.{" "}
          <a
            href={`/order/${orderCode}/status?token=${encodeURIComponent(accessToken)}`}
            className="link-underline font-semibold"
          >
            View status &amp; receipt
          </a>
        </p>
      ) : null}
    </form>
  );
}
