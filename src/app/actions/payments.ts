"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { mediaId } from "@/lib/ids";
import { requireStaff } from "@/lib/auth";
import { markPaymentPaid } from "@/domain/payments";

/**
 * Customer submits payment proof (reference number + optional screenshot).
 * Staff later confirms — the upload alone never marks the order paid.
 */
export async function submitPaymentProof(
  orderId: string,
  accessToken: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.accessToken !== accessToken) {
    return { ok: false, message: "Order not found." };
  }

  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim();
  if (referenceNumber.length < 4) {
    return { ok: false, message: "Enter the reference number from your transfer." };
  }

  const channel = String(formData.get("channel") ?? "vybe");
  let proofPath: string | undefined;

  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, message: "Keep the screenshot under 5 MB." };
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return { ok: false, message: "Upload a JPG, PNG or WebP screenshot." };
    }
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `proof_${mediaId()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "proofs");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);
    proofPath = `/uploads/proofs/${filename}`;
  }

  const payment = await db.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return { ok: false, message: "No payment pending for this order." };

  await db.payment.update({
    where: { id: payment.id },
    data: {
      ...(proofPath ? { proofPath } : {}),
      status: "submitted",
      referenceNote: `Ref ${referenceNumber} via ${channel} — awaiting confirmation`,
      providerPaymentId: referenceNumber,
    },
  });
  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus: "submitted" },
  });

  revalidatePath(`/order/${order.code}`);
  revalidatePath(`/order/${order.code}/status`);
  return {
    ok: true,
    message: "Payment details received. We will confirm once verified — usually within a few hours.",
  };
}

/** @deprecated Use submitPaymentProof */
export async function uploadGcashProof(
  orderId: string,
  accessToken: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!formData.get("referenceNumber")) {
    formData.set("referenceNumber", "screenshot-only");
  }
  return submitPaymentProof(orderId, accessToken, formData);
}

/** Staff confirms a manual payment. */
export async function confirmManualPayment(paymentId: string): Promise<{ ok: boolean; message: string }> {
  const staff = await requireStaff();
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, message: "Payment not found." };
  if (payment.status === "paid") return { ok: true, message: "Already paid." };

  await markPaymentPaid({ paymentId, confirmedByUserId: staff.id });
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  return { ok: true, message: "Payment confirmed." };
}

/** FormData wrapper so boards can share one action id (no per-row inline closures). */
export async function confirmManualPaymentForm(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("paymentId") || "");
  if (!paymentId) return;
  await confirmManualPayment(paymentId);
}

/** Mock adapter: the customer taps "Pay (demo)" and we mark it paid. */
export async function confirmMockPayment(
  paymentId: string,
  token: string,
): Promise<{ ok: boolean; message: string; code?: string }> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment || !payment.isMock) return { ok: false, message: "Not a demo payment." };
  if (payment.order.accessToken !== token) return { ok: false, message: "Invalid token." };

  await markPaymentPaid({ paymentId });
  return { ok: true, message: "Demo payment recorded.", code: payment.order.code };
}
