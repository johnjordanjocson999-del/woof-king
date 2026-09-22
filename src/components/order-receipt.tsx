"use client";

import { useCallback, useRef, useState } from "react";
import { Download, ImageIcon, Printer, X } from "lucide-react";
import { toBlob, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/money";

export type ReceiptLine = {
  name: string;
  qty: number;
  lineTotalCentavos: number;
};

export type ReceiptData = {
  code: string;
  bakeryName: string;
  tagline: string;
  paymentStatus: string;
  fulfillmentLabel: string;
  collectFrom?: string;
  deliverTo?: string;
  contactName: string;
  contactPhone: string;
  items: ReceiptLine[];
  deliveryFeeCentavos: number;
  discountCentavos: number;
  loyaltyNote?: string;
  totalCentavos: number;
  paymentMethod?: string;
  referenceNote?: string;
  placedLabel: string;
};

function statusCopy(status: string) {
  switch (status) {
    case "paid":
      return {
        eyebrow: "Paid in full",
        title: "You’re confirmed",
        body: "Show this receipt at pickup or to the rider. Keep a copy on your phone.",
        tone: "paid" as const,
      };
    case "submitted":
      return {
        eyebrow: "Payment received",
        title: "We’re reviewing your payment",
        body: "Thanks — we have your transfer details. We’ll confirm once verified, usually within a few hours.",
        tone: "review" as const,
      };
    case "pending":
      return {
        eyebrow: "Awaiting payment",
        title: "Finish paying to confirm",
        body: "Your order is held. Complete payment, then save this receipt.",
        tone: "pending" as const,
      };
    default:
      return {
        eyebrow: "Order update",
        title: `Status: ${status}`,
        body: "Keep this receipt for your records.",
        tone: "pending" as const,
      };
  }
}

function isMobileSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua) &&
    /Mobile|iP(ad|hone|od)/i.test(ua)
  );
}

async function captureReceiptPng(node: HTMLElement): Promise<string> {
  if (document.fonts?.ready) await document.fonts.ready;

  const options = {
    cacheBust: true,
    pixelRatio: Math.min(2, window.devicePixelRatio || 2),
    backgroundColor: "#FBEFCD",
    // Skip next/image quirks — receipt uses a plain <img>.
    includeQueryParams: true,
  };

  // Safari often returns a blank canvas on the first pass.
  if (isMobileSafari()) {
    await toPng(node, options);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }

  let dataUrl = await toPng(node, options);
  // Warm until the payload stops growing (Safari lazy paint).
  for (let i = 0; i < 3; i++) {
    const next = await toPng(node, options);
    if (next.length <= dataUrl.length + 32) {
      dataUrl = next;
      break;
    }
    dataUrl = next;
  }
  return dataUrl;
}

async function captureReceiptBlob(node: HTMLElement): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const options = {
    cacheBust: true,
    pixelRatio: Math.min(2, window.devicePixelRatio || 2),
    backgroundColor: "#FBEFCD",
  };
  if (isMobileSafari()) {
    await toBlob(node, options);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Could not render receipt");
  return blob;
}

/** Always save the file directly — no OS share sheet. */
function downloadFile(file: File, href?: string) {
  const url = href || URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke blob URLs after the browser has started the download.
  if (!href || href.startsWith("blob:")) {
    window.setTimeout(() => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }, 2_000);
  }
}

function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Aesthetic bakehouse receipt — download image/PDF directly.
 */
export function OrderReceipt({ data }: { data: ReceiptData }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const copy = statusCopy(data.paymentStatus);
  const fileBase = `Woof-King-${data.code}`;

  const saveImage = useCallback(async () => {
    const node = receiptRef.current;
    if (!node) return;
    setBusy("png");
    setNote(null);
    try {
      const blob = await captureReceiptBlob(node);
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
      downloadFile(file);
      if (isLikelyMobile()) {
        // iOS often ignores <a download> — show long-press preview as backup.
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setNote("If nothing downloaded, long-press the preview below → Add to Photos.");
      } else {
        setNote("Image downloaded — check your Downloads folder.");
      }
    } catch {
      try {
        const dataUrl = await captureReceiptPng(node);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${fileBase}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNote("Image downloaded — check your Downloads folder.");
      } catch {
        setNote("Could not create the image. Try Download PDF instead.");
      }
    } finally {
      setBusy(null);
    }
  }, [fileBase]);

  const savePdf = useCallback(async () => {
    const node = receiptRef.current;
    if (!node) return;
    setBusy("pdf");
    setNote(null);
    try {
      const dataUrl = await captureReceiptPng(node);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = dataUrl;
      });

      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 1200;
      const pdf = new jsPDF({
        orientation: height > width ? "portrait" : "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const scale = Math.min(maxW / width, maxH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const x = (pageW - drawW) / 2;
      const y = margin;
      pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH);

      const blob = pdf.output("blob");
      const file = new File([blob], `${fileBase}.pdf`, { type: "application/pdf" });
      downloadFile(file);
      setNote("PDF downloaded — check your Downloads folder.");
    } catch {
      window.print();
      setNote("Use the print dialog → Save as PDF.");
    } finally {
      setBusy(null);
    }
  }, [fileBase]);

  return (
    <div className="grid gap-6">
      <div className="no-print mx-auto grid w-full max-w-[22rem] gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            className="btn h-12 min-h-12 w-full shadow-none"
            style={{
              background: "var(--ember)",
              color: "var(--on-ember)",
              boxShadow: "none",
            }}
            disabled={busy !== null}
            onClick={() => void saveImage()}
          >
            <Download size={16} aria-hidden className="shrink-0" />
            <span className="truncate">
              {busy === "png" ? "Downloading…" : "Download image"}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost h-12 min-h-12 w-full border-[var(--line-strong)] shadow-none"
            disabled={busy !== null}
            onClick={() => void savePdf()}
          >
            <ImageIcon size={16} aria-hidden className="shrink-0" />
            <span className="truncate">
              {busy === "pdf" ? "Downloading…" : "Download PDF"}
            </span>
          </button>
        </div>
        <p className="faint text-center text-xs leading-5">
          Saves straight to your Downloads folder as a PNG or PDF file.
        </p>
        {note ? <p className="muted text-center text-xs leading-5">{note}</p> : null}
      </div>

      {previewUrl ? (
        <div className="no-print grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Long-press to save</p>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)]"
              aria-label="Close preview"
              onClick={() => {
                if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Receipt ${data.code}`}
            className="mx-auto w-full max-w-[22rem] rounded-[var(--radius-md)]"
          />
          <p className="muted text-center text-xs leading-5">
            Press and hold the image → Add to Photos / Download image.
          </p>
        </div>
      ) : null}

      <div className="receipt-print-root flex justify-center">
        <div
          ref={receiptRef}
          className={cn(
            "receipt-sheet relative w-full max-w-[22rem] overflow-hidden rounded-[var(--radius-lg)]",
            "bg-[var(--paper-solid)] text-[var(--on-ember)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]",
          )}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(80%_100%_at_50%_0%,color-mix(in_oklab,var(--ember)_45%,transparent),transparent)]"
          />

          <div className="relative grid gap-5 px-6 pb-7 pt-6">
            <div className="grid justify-items-center gap-2 text-center">
              {/* Plain img captures reliably on Safari; next/image often blanks. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/woof-king-lockup.png"
                alt=""
                width={286}
                height={310}
                className="h-[72px] w-auto select-none"
                crossOrigin="anonymous"
              />
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_oklab,var(--on-ember)_55%,transparent)]">
                {data.tagline || data.bakeryName}
              </p>
            </div>

            <div className="grid justify-items-center gap-1 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--ember-deep)]">
                {copy.eyebrow}
              </p>
              <p className="font-display text-[1.65rem] leading-tight">{copy.title}</p>
              <p className="max-w-[16rem] text-[0.78rem] leading-5 text-[color-mix(in_oklab,var(--on-ember)_70%,transparent)]">
                {copy.body}
              </p>
            </div>

            <div
              className={cn(
                "grid justify-items-center gap-1 rounded-[var(--radius-md)] border px-4 py-4 text-center",
                copy.tone === "paid" &&
                  "border-[color-mix(in_oklab,var(--sage)_55%,transparent)] bg-[color-mix(in_oklab,var(--sage)_12%,transparent)]",
                copy.tone === "review" &&
                  "border-[color-mix(in_oklab,var(--ember)_50%,transparent)] bg-[color-mix(in_oklab,var(--ember)_14%,transparent)]",
                copy.tone === "pending" &&
                  "border-[color-mix(in_oklab,var(--on-ember)_18%,transparent)] bg-[color-mix(in_oklab,var(--on-ember)_5%,transparent)]",
              )}
            >
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] opacity-60">
                Order code
              </p>
              <p className="font-display text-[1.85rem] leading-none tracking-tight">{data.code}</p>
              <p className="text-[0.7rem] opacity-65">{data.placedLabel}</p>
            </div>

            <div className="grid gap-2 border-t border-[color-mix(in_oklab,var(--on-ember)_14%,transparent)] pt-4 text-[0.82rem]">
              <ReceiptRow label="For" value={data.contactName} />
              <ReceiptRow label="Phone" value={data.contactPhone} />
              <ReceiptRow label="When" value={data.fulfillmentLabel} />
              {data.collectFrom ? <ReceiptRow label="Collect" value={data.collectFrom} /> : null}
              {data.deliverTo ? <ReceiptRow label="Deliver" value={data.deliverTo} /> : null}
              {data.paymentMethod ? (
                <ReceiptRow label="Pay via" value={data.paymentMethod} />
              ) : null}
            </div>

            <ul className="grid gap-2 border-t border-dashed border-[color-mix(in_oklab,var(--on-ember)_18%,transparent)] pt-4">
              {data.items.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex items-baseline justify-between gap-3 text-[0.84rem]"
                >
                  <span>
                    <span className="font-semibold tnum">{item.qty}×</span> {item.name}
                  </span>
                  <span className="shrink-0 font-semibold tnum">
                    {formatPeso(item.lineTotalCentavos)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid gap-1.5 border-t border-[color-mix(in_oklab,var(--on-ember)_14%,transparent)] pt-3 text-[0.84rem]">
              {data.deliveryFeeCentavos > 0 ? (
                <div className="flex justify-between gap-3 opacity-75">
                  <span>Delivery</span>
                  <span className="tnum">{formatPeso(data.deliveryFeeCentavos)}</span>
                </div>
              ) : null}
              {data.discountCentavos > 0 ? (
                <div className="flex justify-between gap-3 text-[var(--sage)]">
                  <span>Member savings</span>
                  <span className="tnum">−{formatPeso(data.discountCentavos)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-2xl tnum">{formatPeso(data.totalCentavos)}</span>
              </div>
            </div>

            {data.referenceNote ? (
              <p className="text-center text-[0.68rem] leading-4 opacity-55">{data.referenceNote}</p>
            ) : null}

            <p className="flex items-center justify-center gap-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] opacity-50">
              <Download size={12} aria-hidden />
              Keep this · show at handoff
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="no-print btn btn-ghost btn-sm mx-auto"
        onClick={() => window.print()}
      >
        <Printer size={14} aria-hidden />
        Print instead
      </button>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] opacity-45">
        {label}
      </span>
      <span className="leading-5">{value}</span>
    </div>
  );
}
