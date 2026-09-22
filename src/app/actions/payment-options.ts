"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { saveUpload } from "@/lib/media";
import { slugifyPaymentName } from "@/domain/payment-options";

function revalidatePayments() {
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
}

export async function createPaymentOption(formData: FormData): Promise<void> {
  await requireStaff();

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Name is required.");

  let slug = String(formData.get("slug") || "").trim() || slugifyPaymentName(name);
  slug = slugifyPaymentName(slug);
  if (!slug) throw new Error("Slug is required.");

  const existing = await db.paymentOption.findUnique({ where: { slug } });
  if (existing) throw new Error(`Slug "${slug}" is already used.`);

  const type = String(formData.get("type") || "qr");
  if (!["qr", "manual", "cash"].includes(type)) throw new Error("Invalid type.");

  let qrImagePath: string | null = null;
  const file = formData.get("qrImage");
  if (file instanceof File && file.size > 0) {
    qrImagePath = (await saveUpload(file, "payments")).path;
  }

  const maxSort = await db.paymentOption.aggregate({ _max: { sortOrder: true } });

  await db.paymentOption.create({
    data: {
      name,
      slug,
      type,
      qrImagePath,
      accountName: String(formData.get("accountName") || "").trim(),
      accountNumber: String(formData.get("accountNumber") || "").trim(),
      instructions: String(formData.get("instructions") || "").trim(),
      active: formData.get("active") === "on",
      availability: String(formData.get("availability") || "online"),
      pickupOnly: formData.get("pickupOnly") === "on" || type === "cash",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePayments();
}

export async function updatePaymentOption(formData: FormData): Promise<void> {
  await requireStaff();

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing option id.");

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Name is required.");

  const type = String(formData.get("type") || "qr");
  if (!["qr", "manual", "cash"].includes(type)) throw new Error("Invalid type.");

  const data: {
    name: string;
    type: string;
    accountName: string;
    accountNumber: string;
    instructions: string;
    active: boolean;
    availability: string;
    pickupOnly: boolean;
    sortOrder: number;
    qrImagePath?: string;
  } = {
    name,
    type,
    accountName: String(formData.get("accountName") || "").trim(),
    accountNumber: String(formData.get("accountNumber") || "").trim(),
    instructions: String(formData.get("instructions") || "").trim(),
    active: formData.get("active") === "on",
    availability: String(formData.get("availability") || "online"),
    pickupOnly: formData.get("pickupOnly") === "on" || type === "cash",
    sortOrder: Number(formData.get("sortOrder") || 0),
  };

  const file = formData.get("qrImage");
  if (file instanceof File && file.size > 0) {
    data.qrImagePath = (await saveUpload(file, "payments")).path;
  }

  await db.paymentOption.update({ where: { id }, data });
  revalidatePayments();
}

export async function togglePaymentOption(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const option = await db.paymentOption.findUnique({ where: { id } });
  if (!option) throw new Error("Option not found.");
  await db.paymentOption.update({
    where: { id },
    data: { active: !option.active },
  });
  revalidatePayments();
}

export async function deletePaymentOption(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  await db.paymentOption.delete({ where: { id } });
  revalidatePayments();
}
