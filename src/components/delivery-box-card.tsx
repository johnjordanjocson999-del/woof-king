"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

const DEFAULT_COPIES = 6;

/**
 * Printable delivery-box sticker: logo + QR to the storefront.
 * Print on sticker paper or plain paper and tape to the box.
 */
export function DeliveryBoxCardPrint({
  initialUrl,
}: {
  initialUrl: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [qr, setQr] = useState<string | null>(null);
  const [copies, setCopies] = useState(DEFAULT_COPIES);
  const [error, setError] = useState<string | null>(null);

  const cleanUrl = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    try {
      const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      return u.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    if (!cleanUrl) {
      setQr(null);
      setError("Enter a valid website link");
      return;
    }
    setError(null);
    void QRCode.toDataURL(cleanUrl, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: "M",
      color: {
        dark: "#3B231F",
        light: "#FBEFCD",
      },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not build QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [cleanUrl]);

  const cards = Array.from({ length: Math.min(12, Math.max(1, copies)) }, (_, i) => i);

  return (
    <div className="box-card-print min-h-dvh bg-[var(--ink)] text-[var(--paper)]">
      <div className="no-print mx-auto grid max-w-3xl gap-4 px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="eyebrow">Packaging</p>
            <h1 className="font-display text-3xl leading-none">Delivery box card</h1>
            <p className="muted max-w-md text-sm leading-6">
              Print these, cut them out, and stick one on each delivery box so customers can
              scan back to the bakery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/delivery" className="btn btn-ghost btn-sm">
              Back
            </a>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Printer size={15} aria-hidden />
              Print cards
            </button>
          </div>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="muted text-xs">Website link inside the QR</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.vercel.app"
            className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
          />
        </label>

        <label className="grid max-w-[10rem] gap-1.5 text-sm">
          <span className="muted text-xs">Cards on the page</span>
          <input
            type="number"
            min={1}
            max={12}
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value) || 1)}
            className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
          />
        </label>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <p className="faint text-xs leading-5">
          Tip: in the print dialog, turn on <strong>Background graphics</strong> so the cream
          card colour prints. Use A4 or Letter paper.
        </p>
      </div>

      <div
        className={cn(
          "mx-auto grid max-w-5xl gap-4 px-4 pb-10",
          "print:max-w-none print:gap-3 print:px-4 print:py-4",
          "sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2",
        )}
      >
        {cards.map((i) => (
          <DeliveryBoxCard key={i} qrDataUrl={qr} siteUrl={cleanUrl} />
        ))}
      </div>
    </div>
  );
}

export function DeliveryBoxCard({
  qrDataUrl,
  siteUrl,
  className,
}: {
  qrDataUrl: string | null;
  siteUrl: string;
  className?: string;
}) {
  const host = (() => {
    try {
      return siteUrl ? new URL(siteUrl).host.replace(/^www\./, "") : "woofking.ph";
    } catch {
      return siteUrl || "woofking.ph";
    }
  })();

  return (
    <article
      className={cn(
        "box-sticker relative overflow-hidden rounded-[1.35rem]",
        "border-[3px] border-[#3B231F] bg-[#FBEFCD] text-[#3B231F]",
        "shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)] print:shadow-none",
        "aspect-[5/6] p-4 sm:p-5",
        className,
      )}
    >
      {/* Soft warm wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, rgba(255,194,9,0.35), transparent 55%), radial-gradient(90% 70% at 100% 100%, rgba(62,134,181,0.12), transparent 50%)",
        }}
      />

      <div className="relative z-[1] grid h-full grid-rows-[auto_1fr_auto] gap-3">
        <div className="flex items-center justify-center">
          {/* Native img so print/PDF keeps the sticker crisp */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/woof-king-lockup.png"
            alt={BRAND.name}
            className="h-[4.75rem] w-auto object-contain sm:h-[5.25rem] print:h-[4.5rem]"
          />
        </div>

        <div className="grid place-items-center gap-2">
          <div className="rounded-[1.1rem] border-2 border-[#3B231F] bg-[#FBEFCD] p-2 shadow-[inset_0_0_0_4px_rgba(255,194,9,0.35)]">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code to ${host}`}
                className="size-[9.5rem] sm:size-[10.5rem] print:size-[9.75rem]"
              />
            ) : (
              <div className="grid size-[9.5rem] place-items-center text-center text-xs text-[#94724C] sm:size-[10.5rem]">
                QR loading…
              </div>
            )}
          </div>
          <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#A3612C]">
            Scan to order
          </p>
        </div>

        <div className="grid gap-1 text-center">
          <p className="font-display text-[1.35rem] leading-none tracking-tight sm:text-[1.45rem]">
            Fresh from the bakehouse
          </p>
          <p className="text-[0.78rem] leading-snug text-[#6B4A2E]">
            {BRAND.tagline}
          </p>
          <p className="mt-1 text-[0.72rem] font-semibold tracking-wide text-[#3B231F]">
            {host}
          </p>
        </div>
      </div>
    </article>
  );
}
