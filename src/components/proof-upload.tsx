"use client";

import { useState, useTransition } from "react";
import { uploadGcashProof } from "@/app/actions/payments";
import { SubmitButton } from "@/components/form";

export function ProofUpload({
  orderId,
  accessToken,
}: {
  orderId: string;
  accessToken: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await uploadGcashProof(orderId, accessToken, formData);
          setOk(result.ok);
          setMessage(result.message);
        });
      }}
    >
      <label className="grid gap-1.5 text-sm font-semibold">
        GCash screenshot
        <input name="proof" type="file" accept="image/*" required disabled={pending || ok} />
      </label>
      <SubmitButton disabled={ok} pendingLabel="Uploading...">
        {ok ? "Uploaded" : "Upload proof"}
      </SubmitButton>
      {message ? (
        <p className={`text-xs ${ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
