"use server";

import { revalidatePath } from "next/cache";
import {
  readSavedAddresses,
  rememberSavedAddress,
  removeSavedAddress,
  setSavedAddressFavorite,
  type SavedAddress,
} from "@/lib/saved-addresses";

export async function toggleFavoriteAddressAction(
  id: string,
  favorite: boolean,
  fallback?: { address: string; instructions?: string; label?: string },
): Promise<SavedAddress[]> {
  const existing = await readSavedAddresses();
  const hit = existing.find((o) => o.id === id);
  if (!hit) {
    if (!fallback?.address) return existing;
    const next = await rememberSavedAddress({
      address: fallback.address,
      instructions: fallback.instructions,
      favorite,
      label: fallback.label || (favorite ? "Favorite" : ""),
    });
    revalidatePath("/checkout");
    return next;
  }
  const next = await setSavedAddressFavorite(id, favorite);
  revalidatePath("/checkout");
  return next;
}

export async function removeSavedAddressAction(id: string): Promise<SavedAddress[]> {
  const next = await removeSavedAddress(id);
  revalidatePath("/checkout");
  return next;
}

/** Save / favorite the address currently typed — before placing an order. */
export async function saveCurrentAddressAction(formData: FormData): Promise<SavedAddress[]> {
  const address = String(formData.get("address") || "");
  const instructions = String(formData.get("instructions") || "");
  const favorite = String(formData.get("favorite") || "") === "1";
  const label = String(formData.get("label") || "").trim();
  const next = await rememberSavedAddress({
    address,
    instructions,
    favorite,
    label: label || (favorite ? "Favorite" : ""),
  });
  revalidatePath("/checkout");
  return next;
}

export async function listSavedAddressesAction(): Promise<SavedAddress[]> {
  return readSavedAddresses();
}
