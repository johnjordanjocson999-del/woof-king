import { cookies } from "next/headers";

/**
 * Recent + favorite delivery places in a cookie (guests and signed-in).
 * Same shape as Order.deliveryAddress — freeform text the rider can use.
 */

const COOKIE = "wk_addresses";
const MAX = 8;
const MAX_AGE = 60 * 60 * 24 * 180; // ~6 months

export type SavedAddress = {
  id: string;
  address: string;
  instructions: string;
  favorite: boolean;
  /** Epoch ms — most recent use first among non-favorites. */
  lastUsedAt: number;
  label: string;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseAddress(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function samePlace(a: string, b: string): boolean {
  return normaliseAddress(a).toLowerCase() === normaliseAddress(b).toLowerCase();
}

function sanitise(value: unknown): SavedAddress[] {
  if (!Array.isArray(value)) return [];
  const out: SavedAddress[] = [];
  for (const entry of value.slice(0, MAX * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const address = normaliseAddress(String(raw.address ?? ""));
    if (address.length < 8) continue;
    if (out.some((o) => samePlace(o.address, address))) continue;
    const id = String(raw.id ?? "").trim() || newId();
    const instructions = String(raw.instructions ?? "").trim().slice(0, 400);
    const label = String(raw.label ?? "").trim().slice(0, 40);
    const lastUsedAt = Number(raw.lastUsedAt);
    out.push({
      id,
      address: address.slice(0, 300),
      instructions,
      favorite: Boolean(raw.favorite),
      lastUsedAt: Number.isFinite(lastUsedAt) ? lastUsedAt : Date.now(),
      label,
    });
    if (out.length >= MAX) break;
  }
  return out;
}

/** Favorites first, then most recently used. */
export function sortSavedAddresses(list: SavedAddress[]): SavedAddress[] {
  return [...list].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.lastUsedAt - a.lastUsedAt;
  });
}

export async function readSavedAddresses(): Promise<SavedAddress[]> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return [];
  try {
    return sortSavedAddresses(sanitise(JSON.parse(decodeURIComponent(raw))));
  } catch {
    try {
      return sortSavedAddresses(sanitise(JSON.parse(raw)));
    } catch {
      return [];
    }
  }
}

async function writeSavedAddresses(list: SavedAddress[]): Promise<void> {
  const jar = await cookies();
  const clean = sortSavedAddresses(sanitise(list)).slice(0, MAX);
  if (clean.length === 0) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, JSON.stringify(clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/**
 * Upsert by address text. Bumps lastUsedAt; optional favorite / label / instructions.
 * Keeps favorites when the same place is reused.
 */
export async function rememberSavedAddress(input: {
  address: string;
  instructions?: string;
  favorite?: boolean;
  label?: string;
}): Promise<SavedAddress[]> {
  const address = normaliseAddress(input.address);
  if (address.length < 8) return readSavedAddresses();

  const existing = await readSavedAddresses();
  const hit = existing.find((o) => samePlace(o.address, address));
  const rest = existing.filter((o) => !samePlace(o.address, address));
  const next: SavedAddress = {
    id: hit?.id ?? newId(),
    address: address.slice(0, 300),
    instructions: (input.instructions ?? hit?.instructions ?? "").trim().slice(0, 400),
    favorite: input.favorite ?? hit?.favorite ?? false,
    lastUsedAt: Date.now(),
    label: (input.label ?? hit?.label ?? "").trim().slice(0, 40),
  };
  const merged = sortSavedAddresses([next, ...rest]).slice(0, MAX);
  await writeSavedAddresses(merged);
  return merged;
}

export async function setSavedAddressFavorite(
  id: string,
  favorite: boolean,
): Promise<SavedAddress[]> {
  const existing = await readSavedAddresses();
  const next = existing.map((o) => (o.id === id ? { ...o, favorite } : o));
  await writeSavedAddresses(next);
  return sortSavedAddresses(next);
}

export async function removeSavedAddress(id: string): Promise<SavedAddress[]> {
  const existing = await readSavedAddresses();
  const next = existing.filter((o) => o.id !== id);
  await writeSavedAddresses(next);
  return next;
}

/** Build freeform line from Customer CRM fields when present. */
export function composeCustomerAddress(customer: {
  addressLine: string;
  barangay: string;
  city: string;
  deliveryInstructions?: string;
}): { address: string; instructions: string } | null {
  const parts = [customer.addressLine, customer.barangay, customer.city]
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // Avoid "line, barangay, city" duplication if addressLine already includes them.
  const address = parts[0].length >= 8 && parts.length > 1 && parts[0].includes(parts[1])
    ? parts[0]
    : parts.join(", ");
  if (address.length < 8) return null;
  return {
    address,
    instructions: (customer.deliveryInstructions ?? "").trim(),
  };
}

/** Merge CRM / cookie lists for the checkout picker (cookie wins on conflict). */
export function mergeAddressLists(
  primary: SavedAddress[],
  extras: SavedAddress[],
): SavedAddress[] {
  const out = [...primary];
  for (const extra of extras) {
    if (out.some((o) => samePlace(o.address, extra.address))) continue;
    out.push(extra);
  }
  return sortSavedAddresses(out).slice(0, MAX);
}
