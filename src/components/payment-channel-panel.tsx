"use client";

import Image from "next/image";
import { useState } from "react";
import { PaymentProofForm } from "@/components/payment-proof-form";
import { formatPeso } from "@/lib/money";
import { Notice } from "@/components/ui";
import type { CheckoutPaymentOption } from "@/domain/payment-options";

type PaymentMode = "qr" | "manual";

export function PaymentChannelPanel({
  orderId,
  accessToken,
  orderCode,
  amountCentavos,
  option,
  paymentStatus,
}: {
  orderId: string;
  accessToken: string;
  orderCode: string;
  amountCentavos: number;
  option: CheckoutPaymentOption;
  paymentStatus: string;
}) {
  const hasQr = Boolean(option.qrImagePath) && option.type === "qr";
  const [mode, setMode] = useState<PaymentMode>(hasQr ? "qr" : "manual");

  const accountLine = [option.accountName, option.accountNumber].filter(Boolean).join(" · ");

  return (
    <div className="grid gap-5">
      <Notice tone="info" title={`Pay ${formatPeso(amountCentavos)} via ${option.name}`}>
        Use your order code <strong>{orderCode}</strong> as the payment reference. Your order is
        confirmed once we verify payment.
      </Notice>

      {hasQr ? (
        <div className="grid items-stretch gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={`choice h-full ${mode === "qr" ? "is-selected" : ""}`}
            onClick={() => setMode("qr")}
          >
            <span className="grid gap-1">
              <span className="font-display text-lg">Scan QR</span>
              <span className="muted text-xs font-normal">Open your banking or e-wallet app</span>
            </span>
          </button>
          <button
            type="button"
            className={`choice h-full ${mode === "manual" ? "is-selected" : ""}`}
            onClick={() => setMode("manual")}
          >
            <span className="grid gap-1">
              <span className="font-display text-lg">Manual transfer</span>
              <span className="muted text-xs font-normal">
                Send manually, then enter reference or upload proof
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {mode === "qr" && option.qrImagePath ? (
        <div className="grid justify-items-center gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-5">
          <div className="relative aspect-square w-full max-w-[min(240px,70vw)] overflow-hidden rounded-[var(--radius-sm)] bg-white">
            <Image
              src={option.qrImagePath}
              alt={`${option.name} payment QR code`}
              fill
              sizes="240px"
              className="object-contain"
            />
          </div>
          {option.instructions ? (
            <p className="muted text-center text-xs leading-5">{option.instructions}</p>
          ) : null}
          {accountLine ? <p className="text-center text-sm font-semibold">{accountLine}</p> : null}
          <p className="font-display text-xl">{formatPeso(amountCentavos)}</p>
          <p className="faint text-center text-xs">
            Reference: <strong>{orderCode}</strong>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-5">
          {option.instructions ? (
            <p className="text-sm leading-6">{option.instructions}</p>
          ) : null}
          <dl className="grid gap-2 text-sm">
            {option.accountName ? (
              <div className="flex justify-between gap-4">
                <dt className="muted">Account name</dt>
                <dd className="text-right font-semibold">{option.accountName}</dd>
              </div>
            ) : null}
            {option.accountNumber ? (
              <div className="flex justify-between gap-4">
                <dt className="muted">Number / account</dt>
                <dd className="text-right font-mono text-sm">{option.accountNumber}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="muted">Amount</dt>
              <dd className="price font-semibold">{formatPeso(amountCentavos)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Reference</dt>
              <dd className="font-mono text-sm">{orderCode}</dd>
            </div>
          </dl>
        </div>
      )}

      <PaymentProofForm
        orderId={orderId}
        accessToken={accessToken}
        channel={option.slug}
        orderCode={orderCode}
        disabled={paymentStatus === "submitted" || paymentStatus === "paid"}
        submitted={paymentStatus === "submitted"}
      />
    </div>
  );
}

export function CashPaymentPanel({
  orderCode,
  amountCentavos,
  instructions,
}: {
  orderCode: string;
  amountCentavos: number;
  instructions?: string;
}) {
  return (
    <div className="grid gap-4">
      <Notice tone="info" title="Pay cash at pickup">
        Bring <strong>{formatPeso(amountCentavos)}</strong> and show order code{" "}
        <strong>{orderCode}</strong> when you collect. Staff will mark your order paid at the
        counter.
      </Notice>
      {instructions ? <p className="muted text-sm leading-6">{instructions}</p> : null}
    </div>
  );
}
