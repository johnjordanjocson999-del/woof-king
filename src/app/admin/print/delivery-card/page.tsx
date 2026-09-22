import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { DeliveryBoxCardPrint } from "@/components/delivery-box-card";

export const metadata: Metadata = {
  title: "Delivery box cards",
};

/**
 * Standalone print sheet (outside admin chrome) — QR stickers for delivery boxes.
 */
export default async function DeliveryBoxCardPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const initialUrl =
    params.url?.trim() ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://woof-king.vercel.app";

  return <DeliveryBoxCardPrint initialUrl={initialUrl} />;
}
