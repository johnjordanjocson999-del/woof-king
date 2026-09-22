import type { Centavos } from "@/lib/money";
import type { Settings } from "@prisma/client";

/** Flat delivery fee for now (₱50). Distance / map pin can replace this later. */
export const DEFAULT_DELIVERY_FEE_CENTAVOS = 5000;

export function flatDeliveryFeeCentavos(
  settings: Pick<Settings, "deliveryBaseFeeCentavos">,
): Centavos {
  const fee = settings.deliveryBaseFeeCentavos;
  return fee > 0 ? fee : DEFAULT_DELIVERY_FEE_CENTAVOS;
}
