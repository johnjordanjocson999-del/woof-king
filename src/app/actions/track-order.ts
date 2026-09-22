"use server";

import { rememberOrder } from "@/lib/tracked-orders";

/** Safe to call from a client effect after opening a private order link. */
export async function trackOrderVisit(code: string, token: string): Promise<void> {
  if (!code || !token) return;
  await rememberOrder(code, token);
}
