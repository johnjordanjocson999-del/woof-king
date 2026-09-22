"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { markPaymentPaid } from "@/domain/payments";

export async function confirmPaymentForm(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const paymentId = String(formData.get("paymentId") || "");
  if (!paymentId) throw new Error("Missing payment.");

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === "paid") {
    revalidatePath("/admin", "layout");
    return;
  }

  await markPaymentPaid({ paymentId, confirmedByUserId: staff.id });
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${payment.order.code}`);
}

/** Send a submitted payment back to pending (e.g. wrong proof). */
export async function rejectPaymentForm(formData: FormData): Promise<void> {
  await requireStaff();
  const paymentId = String(formData.get("paymentId") || "");
  const note = String(formData.get("note") || "").trim();
  if (!paymentId) throw new Error("Missing payment.");

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === "paid") throw new Error("Already paid — cannot reject.");

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: "pending",
      referenceNote: note
        ? `Needs new proof: ${note}`
        : "Staff asked for a clearer proof / reference.",
    },
  });
  await db.order.update({
    where: { id: payment.orderId },
    data: { paymentStatus: "pending" },
  });
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${payment.order.code}`);
}
